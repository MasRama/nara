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
    expect((await asDevice(admin.cookie, `/api/roles/${role.id}`, 'PUT', { permissions: [] })).status).toBe(200);
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
});
