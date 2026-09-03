/// <reference lib="dom" />
import { randomUUID } from 'node:crypto';
import { createApp, nextTick } from 'vue';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../../../app/App.vue';
import router from '../../../app/router';
import { app as serverApp } from '../../../app/server';
import { getDatabase, seed } from '../../../shared/database';
import { useAuthSession } from '../web';

const TEST_PASSWORD = 'correct horse battery staple';

let container: HTMLDivElement;
let application: { unmount(): void } | undefined;
let sessionCookie: string | undefined;
let pendingFetches: Set<Promise<Response>>;

function installApiFetch(): void {
  const request = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const inputUrl = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const url = new URL(inputUrl, 'http://nara.test');
    const method = init?.method ?? (input instanceof Request ? input.method : 'GET');
    const headers = new Headers(input instanceof Request ? input.headers : undefined);
    for (const [name, value] of new Headers(init?.headers)) headers.set(name, value);
    if (sessionCookie) headers.set('Cookie', sessionCookie);
    const outgoingRequest = new Request(url.href, { method, headers, body: init?.body });
    const requestBody = ['GET', 'HEAD'].includes(method.toUpperCase()) ? undefined : await outgoingRequest.arrayBuffer();
    const response = await serverApp.request(url.pathname + url.search, {
      method: outgoingRequest.method,
      headers: outgoingRequest.headers,
      body: requestBody,
    });
    const setCookie = response.headers.get('set-cookie');
    if (setCookie) {
      const cookie = setCookie.split(';', 1)[0];
      sessionCookie = cookie.endsWith('=') ? undefined : cookie;
    }
    const body = await response.text();
    return {
      ok: response.ok,
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
      json: async () => JSON.parse(body),
      text: async () => body,
    } as Response;
  };

  vi.stubGlobal('fetch', (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const response = request(input, init);
    pendingFetches.add(response);
    void response.finally(() => pendingFetches.delete(response));
    return response;
  });
}

async function registerDirect(email: string, name: string): Promise<string> {
  const response = await serverApp.request('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email, password: TEST_PASSWORD }),
  });
  expect(response.status).toBe(201);
  const cookie = response.headers.get('set-cookie')?.split(';', 1)[0];
  if (!cookie) throw new Error('Registration did not return a session cookie');
  return cookie;
}

function userIdForEmail(email: string): string {
  const row = getDatabase().prepare('SELECT id FROM users WHERE email = ?').get(email) as { id: string } | undefined;
  if (!row) throw new Error(`Missing test user ${email}`);
  return row.id;
}

function roleIdForSlug(slug: string): string {
  const row = getDatabase().prepare('SELECT id FROM roles WHERE slug = ?').get(slug) as { id: string } | undefined;
  if (!row) throw new Error(`Missing test role ${slug}`);
  return row.id;
}

function assignRole(userId: string, slug: string): void {
  getDatabase()
    .prepare('INSERT OR IGNORE INTO user_roles (id, user_id, role_id, created_at) VALUES (?, ?, ?, ?)')
    .run(randomUUID(), userId, roleIdForSlug(slug), Date.now());
}

async function startAuthenticatedAdmin(): Promise<void> {
  const email = `${randomUUID()}@example.com`;
  sessionCookie = await registerDirect(email, 'RBAC Browser Administrator');
  assignRole(userIdForEmail(email), 'admin');
  await useAuthSession().refresh();
}

async function settle(): Promise<void> {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    if (pendingFetches.size > 0) await Promise.all([...pendingFetches]);
    await Promise.resolve();
    await nextTick();
  }
}

async function mountAt(path: string): Promise<void> {
  await router.push(path);
  await router.isReady();
  const mountedApplication = createApp(App).use(router);
  mountedApplication.mount(container);
  application = mountedApplication;
  await nextTick();
}

function setInput(selector: string, value: string): void {
  const input = container.querySelector(selector);
  if (!(input instanceof HTMLInputElement)) throw new Error(`Missing input ${selector}`);
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

function submitForm(selector: string): void {
  const form = container.querySelector(selector);
  if (!(form instanceof HTMLFormElement)) throw new Error(`Missing form ${selector}`);
  form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
}

async function click(selector: string): Promise<void> {
  const element = container.querySelector<HTMLElement>(selector);
  if (!element) throw new Error(`Missing element ${selector}`);
  element.click();
  await nextTick();
}

function tableRowContaining(text: string): HTMLTableRowElement {
  const row = [...container.querySelectorAll<HTMLTableRowElement>('tbody tr')].find((candidate) => candidate.textContent?.includes(text));
  if (!row) throw new Error(`Missing table row containing ${text}`);
  return row;
}

beforeEach(async () => {
  container = document.createElement('div');
  document.body.append(container);
  application = undefined;
  sessionCookie = undefined;
  pendingFetches = new Set();
  seed();
  installApiFetch();
  await useAuthSession().logout();
  await router.push('/');
  await router.isReady();
});

afterEach(async () => {
  application?.unmount();
  application = undefined;
  await useAuthSession().logout();
  await router.push('/');
  container.remove();
  vi.unstubAllGlobals();
});

describe('roles and permissions browser surfaces', () => {
  it('lists roles with server user counts and persists role permission CRUD', async () => {
    await startAuthenticatedAdmin();
    await mountAt('/roles');
    await settle();

    const adminRoleId = roleIdForSlug('admin');
    const adminRow = container.querySelector<HTMLTableRowElement>(`tr[data-role-id="${adminRoleId}"]`);
    expect(adminRow).not.toBeNull();
    expect(adminRow?.querySelector('[data-testid="role-user-count"]')?.textContent).toMatch(/^\d+$/);

    const roleSlug = `browser-role-${randomUUID()}`;
    await click('[data-testid="create-role"]');
    setInput('#role-name', 'Browser Billing');
    setInput('#role-slug', roleSlug);
    await click('[data-permission-slug="users.view"]');
    submitForm('[data-testid="role-form"]');
    await settle();

    const createdRow = tableRowContaining(roleSlug);
    const roleId = createdRow.dataset.roleId;
    if (!roleId) throw new Error('Created role row did not expose its id');
    expect(createdRow.textContent).toContain('users.view');

    await click(`[data-testid="edit-role-${roleId}"]`);
    setInput('#role-name', 'Updated Browser Billing');
    await click('[data-permission-slug="users.edit"]');
    submitForm('[data-testid="role-form"]');
    await settle();

    const updatedRow = tableRowContaining(roleSlug);
    expect(updatedRow.textContent).toContain('Updated Browser Billing');
    expect(updatedRow.textContent).toContain('users.edit');

    const rolesResponse = await serverApp.request('/api/roles', { headers: { Cookie: sessionCookie! } });
    const rolesPayload = (await rolesResponse.json()) as {
      data: { roles: Array<{ slug: string; permissions: string[]; userCount: number }> };
    };
    const persistedRole = rolesPayload.data.roles.find((role) => role.slug === roleSlug);
    expect(persistedRole).toMatchObject({
      permissions: expect.arrayContaining(['users.view', 'users.edit']),
      userCount: 0,
    });

    await click(`[data-testid="delete-role-${roleId}"]`);
    await click('[data-testid="confirm-role-delete"]');
    await settle();
    expect(container.querySelector(`tr[data-role-id="${roleId}"]`)).toBeNull();

    await click(`[data-testid="delete-role-${adminRoleId}"]`);
    await click('[data-testid="confirm-role-delete"]');
    await settle();
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('Cannot delete the admin role');
    expect(container.querySelector(`tr[data-role-id="${adminRoleId}"]`)).not.toBeNull();
  });
});
