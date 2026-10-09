/// <reference lib="dom" />
import { randomUUID } from 'node:crypto';
import { createApp, nextTick } from 'vue';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../App.vue';
import router from '../router';
import { app as serverApp } from '../server';
import { useAuthSession } from '../../features/auth/web';
import { getDatabase, seed } from '../../shared/database';
import { closeEventStreams } from '../../shared/realtime';
import { readEvents, type EventReader } from '../../shared/realtime/tests/helpers';
import { csrfHeaders, issueCsrf, mergeResponseCookies } from '../../shared/security/tests/helpers';

/**
 * The open tab follows the server: the real application streams events and a
 * stand-in EventSource delivers them to the mounted app, as a browser would.
 */
const PASSWORD = 'correct horse battery staple';

let container: HTMLDivElement;
let application: { unmount(): void } | undefined;
/** The tab's cookies; other devices keep their own. */
let tabCookie = '';
let pending: Set<Promise<unknown>>;

function track<T>(promise: Promise<T>): Promise<T> {
  pending.add(promise);
  void promise.finally(() => pending.delete(promise)).catch(() => undefined);
  return promise;
}

class StreamedEventSource extends EventTarget {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSED = 2;
  readyState = StreamedEventSource.CONNECTING;
  private events: EventReader | undefined;

  constructor(url: string) {
    super();
    void track(this.open(url));
  }

  private async open(url: string): Promise<void> {
    const response = await serverApp.request(url, { headers: { Cookie: tabCookie } });
    if (this.readyState === StreamedEventSource.CLOSED) return;
    if (response.status !== 200) {
      this.readyState = StreamedEventSource.CLOSED;
      this.dispatchEvent(new Event('error'));
      return;
    }
    this.readyState = StreamedEventSource.OPEN;
    this.events = readEvents(response);
    void this.pump();
  }

  private async pump(): Promise<void> {
    for (;;) {
      const event = await this.events!.next(60_000);
      if (this.readyState === StreamedEventSource.CLOSED) return;
      if (event === 'closed') {
        this.readyState = StreamedEventSource.CONNECTING;
        this.dispatchEvent(new Event('error'));
        return;
      }
      if (event !== 'timeout') await track(Promise.resolve(this.dispatchEvent(new Event(event))));
    }
  }

  close(): void {
    this.readyState = StreamedEventSource.CLOSED;
    void this.events?.cancel();
  }
}

function installTabFetch(): void {
  vi.stubGlobal('fetch', (input: RequestInfo | URL, init?: RequestInit) =>
    track(
      (async () => {
        const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url, 'http://nara.test');
        const headers = new Headers(init?.headers);
        if (tabCookie) headers.set('Cookie', tabCookie);
        const response = await serverApp.request(url.pathname + url.search, { method: init?.method ?? 'GET', headers, body: init?.body });
        tabCookie = mergeResponseCookies(tabCookie, response);
        for (const pair of tabCookie.split('; ')) if (pair.startsWith('csrf_token=')) document.cookie = pair;
        return response;
      })(),
    ),
  );
}

/** Sends a request as another device holding `cookie`; returns the updated cookie. */
async function asDevice(cookie: string, path: string, method: string, body?: unknown): Promise<{ status: number; cookie: string }> {
  const state = await issueCsrf(serverApp, cookie || undefined);
  const response = await serverApp.request(path, {
    method,
    headers: csrfHeaders(state, { 'Content-Type': 'application/json' }),
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: response.status, cookie: mergeResponseCookies(state.cookie, response) };
}

async function register(): Promise<{ id: string; email: string; cookie: string }> {
  const email = `${randomUUID()}@example.com`;
  const { status, cookie } = await asDevice('', '/api/auth/register', 'POST', { name: 'Live Browser', email, password: PASSWORD });
  expect(status).toBe(201);
  const row = getDatabase().prepare('SELECT id FROM users WHERE email = ?').get(email) as { id: string };
  return { id: row.id, email, cookie };
}

function grantRole(userId: string, slug: string): void {
  const role = getDatabase().prepare('SELECT id FROM roles WHERE slug = ?').get(slug) as { id: string };
  getDatabase()
    .prepare('INSERT INTO user_roles (id, user_id, role_id, created_at) VALUES (?, ?, ?, ?)')
    .run(randomUUID(), userId, role.id, Date.now());
}

/** Opens the app in this tab as the account behind `cookie`. */
async function openTab(cookie: string, path: string): Promise<void> {
  tabCookie = cookie;
  await useAuthSession().refresh();
  await router.push(path);
  await router.isReady();
  const mounted = createApp(App).use(router);
  mounted.mount(container);
  application = mounted;
  await settle();
}

/** Types into a form field the way a person would. */
function type(selector: string, value: string): void {
  const field = container.querySelector<HTMLInputElement>(selector);
  expect(field).not.toBeNull();
  field!.value = value;
  field!.dispatchEvent(new Event('input'));
}

function fieldValue(selector: string): string | undefined {
  return container.querySelector<HTMLInputElement>(selector)?.value;
}

async function click(selector: string): Promise<void> {
  const button = container.querySelector<HTMLButtonElement>(selector);
  expect(button).not.toBeNull();
  button!.click();
  await settle();
}

async function settle(): Promise<void> {
  for (let round = 0; round < 12; round += 1) {
    if (pending.size > 0) await Promise.allSettled([...pending]);
    await new Promise((resolve) => setTimeout(resolve, 5));
    await nextTick();
  }
}

beforeEach(async () => {
  seed();
  container = document.createElement('div');
  document.body.append(container);
  application = undefined;
  tabCookie = '';
  pending = new Set();
  installTabFetch();
  vi.stubGlobal('EventSource', StreamedEventSource);
  await useAuthSession().refresh();
  await router.push('/');
  await router.isReady();
});

afterEach(async () => {
  application?.unmount();
  closeEventStreams();
  await settle();
  container.remove();
  tabCookie = '';
  await useAuthSession().refresh();
  vi.unstubAllGlobals();
});

describe('live updates in the open tab', () => {
  it('sends the tab to sign in, saying why, when another device ends its session', async () => {
    const account = await register();
    await openTab(account.cookie, '/security');
    expect(router.currentRoute.value.name).toBe('security');

    const phone = await asDevice('', '/api/auth/login', 'POST', { email: account.email, password: PASSWORD });
    expect((await asDevice(phone.cookie, '/api/auth/sessions/revoke-others', 'POST')).status).toBe(200);
    await settle();

    expect(router.currentRoute.value.name).toBe('login');
    expect(router.currentRoute.value.query).toMatchObject({ redirect: '/security', reason: 'session-ended' });
    expect(container.querySelector('[role="status"]')?.textContent).toContain('Your session was ended');
  });

  it('leaves a page as soon as an administrator takes away the permission it needs', async () => {
    const admin = await register();
    grantRole(admin.id, 'admin');
    const member = await register();
    const slug = `live-${randomUUID().slice(0, 8)}`;
    expect(
      (await asDevice(admin.cookie, '/api/roles', 'POST', { name: 'Live Readers', slug, permissions: ['activity.view'] })).status,
    ).toBe(201);
    grantRole(member.id, slug);

    await openTab(member.cookie, '/activity');
    expect(router.currentRoute.value.name).toBe('activity');

    const role = getDatabase().prepare('SELECT id FROM roles WHERE slug = ?').get(slug) as { id: string };
    expect((await asDevice(admin.cookie, `/api/roles/${role.id}`, 'PUT', { revision: 1, permissions: [] })).status).toBe(200);
    await settle();

    expect(router.currentRoute.value.name).toBe('dashboard');
    expect(useAuthSession().can('activity.view')).toBe(false);
  });

  it('shows new activity on the first page without a reload', async () => {
    const admin = await register();
    grantRole(admin.id, 'admin');
    const member = await register();
    await openTab(admin.cookie, '/activity');
    const newest = () => container.querySelector('.act-event')?.textContent ?? '';
    expect(newest()).toContain('Account registered');

    expect((await asDevice('', '/api/auth/login', 'POST', { email: member.email, password: PASSWORD })).status).toBe(200);
    await settle();

    expect(newest()).toContain('Signed in');
    expect(newest()).toContain(member.id);
  });

  it('lists a device as it signs in and drops it as it signs out', async () => {
    const account = await register();
    await openTab(account.cookie, '/security');
    const devices = () => container.querySelectorAll('[data-testid="session-row"]').length;
    expect(devices()).toBe(1);

    const phone = await asDevice('', '/api/auth/login', 'POST', { email: account.email, password: PASSWORD });
    await settle();
    expect(devices()).toBe(2);

    expect((await asDevice(phone.cookie, '/api/auth/logout', 'POST')).status).toBe(200);
    await settle();
    expect(devices()).toBe(1);
    expect(router.currentRoute.value.name).toBe('security');
  });

  it("shows another administrator's new role without a reload", async () => {
    const admin = await register();
    grantRole(admin.id, 'admin');
    const colleague = await register();
    grantRole(colleague.id, 'admin');
    await openTab(admin.cookie, '/roles');
    const slug = `live-${randomUUID().slice(0, 8)}`;
    expect(container.querySelector('[data-testid="role-list"]')?.textContent).not.toContain(slug);

    expect((await asDevice(colleague.cookie, '/api/roles', 'POST', { name: 'Live Editors', slug, permissions: [] })).status).toBe(201);
    await settle();

    expect(container.querySelector('[data-testid="role-list"]')?.textContent).toContain(slug);
  });

  it("merges another administrator's save into an open role form and asks only about the field both changed", async () => {
    const admin = await register();
    grantRole(admin.id, 'admin');
    const colleague = await register();
    grantRole(colleague.id, 'admin');
    const slug = `live-${randomUUID().slice(0, 8)}`;
    expect((await asDevice(colleague.cookie, '/api/roles', 'POST', { name: 'Live Editors', slug, permissions: [] })).status).toBe(201);
    const role = getDatabase().prepare('SELECT id FROM roles WHERE slug = ?').get(slug) as { id: string };

    await openTab(admin.cookie, '/roles');
    await click(`[data-testid="edit-role-${role.id}"]`);
    type('#role-name', 'Mine');
    await settle();

    const theirSlug = `${slug}-theirs`;
    expect((await asDevice(colleague.cookie, `/api/roles/${role.id}`, 'PUT', { revision: 1, name: 'Theirs', slug: theirSlug })).status).toBe(200);
    await settle();

    // The slug only they changed follows their save; the name both changed waits for a choice.
    expect(fieldValue('#role-slug')).toBe(theirSlug);
    expect(fieldValue('#role-name')).toBe('Mine');
    expect(container.querySelector('[data-testid="role-merge-notice"]')?.textContent).toContain('Slug');
    const conflicts = [...container.querySelectorAll('[data-testid="role-conflicts"] [data-conflict-field]')].map((row) => row.getAttribute('data-conflict-field'));
    expect(conflicts).toEqual(['name']);
    expect(container.querySelector<HTMLButtonElement>('[data-testid="role-form"] button[type="submit"]')?.disabled).toBe(true);

    await click('[data-testid="keep-mine-name"]');
    expect(container.querySelector('[data-testid="role-conflicts"]')).toBeNull();
    container.querySelector<HTMLFormElement>('[data-testid="role-form"]')!.requestSubmit();
    await settle();

    expect(getDatabase().prepare('SELECT name, slug, revision FROM roles WHERE id = ?').get(role.id)).toEqual({ name: 'Mine', slug: theirSlug, revision: 3 });
    expect(container.querySelector('[data-testid="role-form"]')).toBeNull();
  });

  it('shows who else has the same role open, and drops them when they close it', async () => {
    const admin = await register();
    grantRole(admin.id, 'admin');
    const colleague = await register();
    grantRole(colleague.id, 'admin');
    getDatabase().prepare('UPDATE users SET name = ? WHERE id = ?').run('Grace Colleague', colleague.id);
    const slug = `live-${randomUUID().slice(0, 8)}`;
    expect((await asDevice(colleague.cookie, '/api/roles', 'POST', { name: 'Live Editors', slug, permissions: [] })).status).toBe(201);
    const role = getDatabase().prepare('SELECT id FROM roles WHERE slug = ?').get(slug) as { id: string };

    await openTab(admin.cookie, '/roles');
    await click(`[data-testid="edit-role-${role.id}"]`);
    // The tab's own presence is not news to it.
    expect(container.querySelector('[data-testid="role-editors"]')).toBeNull();

    expect((await asDevice(colleague.cookie, `/api/roles/${role.id}/editing`, 'PUT')).status).toBe(200);
    await settle();
    expect(container.querySelector('[data-testid="role-editors"]')?.textContent).toContain('Grace Colleague is also editing this role');
    expect(container.querySelector('[data-testid="role-editing"]')?.textContent).toContain('Grace Colleague');

    expect((await asDevice(colleague.cookie, `/api/roles/${role.id}/editing`, 'DELETE')).status).toBe(200);
    await settle();
    expect(container.querySelector('[data-testid="role-editors"]')).toBeNull();
  });

  it("follows an administrator's change to the open profile, keeping what the account is typing", async () => {
    const admin = await register();
    grantRole(admin.id, 'admin');
    const member = await register();

    await openTab(member.cookie, '/profile');
    expect(fieldValue('#name')).toBe('Live Browser');
    const renamed = `${randomUUID()}@example.com`;
    expect((await asDevice(admin.cookie, `/api/users/${member.id}`, 'PUT', { revision: 1, email: renamed })).status).toBe(200);
    await settle();
    expect(fieldValue('#email')).toBe(renamed);

    type('#name', 'Typed Here');
    await settle();
    expect((await asDevice(admin.cookie, `/api/users/${member.id}`, 'PUT', { revision: 2, name: 'Admin Pick' })).status).toBe(200);
    await settle();

    expect(fieldValue('#name')).toBe('Typed Here');
    expect(container.querySelector('[data-testid="profile-conflicts"] [data-conflict-field="name"]')).not.toBeNull();
    await click('[data-testid="use-theirs-name"]');
    expect(fieldValue('#name')).toBe('Admin Pick');
    expect(container.querySelector('[data-testid="profile-conflicts"]')).toBeNull();
  });
});
