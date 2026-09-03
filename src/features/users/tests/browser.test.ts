/// <reference lib="dom" />
/// <reference lib="dom.iterable" />
import { randomUUID } from 'node:crypto';
import { File as NodeFile } from 'node:buffer';
import { rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createApp, nextTick } from 'vue';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../../../app/App.vue';
import router from '../../../app/router';
import { app as serverApp } from '../../../app/server';
import { getDatabase, seed } from '../../../shared/database';
import { useAuthSession } from '../../auth/web';
import { createUsersClient } from '../web';

const TEST_PASSWORD = 'correct horse battery staple';
const ONE_PIXEL_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
);
interface TestFile {
  readonly name: string;
  readonly type: string;
  readonly size: number;
  arrayBuffer(): Promise<ArrayBuffer>;
}

class BrowserFormData {
  private readonly values = new Map<string, string | TestFile>();

  set(name: string, value: string | TestFile): void {
    this.values.set(name, value);
  }

  entries(): IterableIterator<[string, string | TestFile]> {
    return this.values.entries();
  }
}

async function encodeMultipart(file: TestFile): Promise<{ body: ArrayBuffer; contentType: string }> {
  const boundary = `----nara-test-${randomUUID()}`;
  const prefix = new TextEncoder().encode(
    `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${file.name}"\r\nContent-Type: ${file.type}\r\n\r\n`,
  );
  const contents = new Uint8Array(await file.arrayBuffer());
  const suffix = new TextEncoder().encode(`\r\n--${boundary}--\r\n`);
  const body = new Uint8Array(prefix.length + contents.length + suffix.length);
  body.set(prefix);
  body.set(contents, prefix.length);
  body.set(suffix, prefix.length + contents.length);
  return { body: body.buffer as ArrayBuffer, contentType: `multipart/form-data; boundary=${boundary}` };
}

let container: HTMLDivElement;
let application: { unmount(): void } | undefined;
let sessionCookie: string | undefined;
let fetchRequests: Array<{ method: string; path: string }>;
let fetchUrls: string[];
let pendingFetches: Set<Promise<Response>>;

function installApiFetch(): void {
  const request = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const inputUrl = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const url = new URL(inputUrl, 'http://nara.test');
    const method = init?.method ?? (input instanceof Request ? input.method : 'GET');
    fetchUrls.push(url.pathname + url.search);
    fetchRequests.push({ method, path: url.pathname });

    const headers = new Headers(input instanceof Request ? input.headers : undefined);
    for (const [name, value] of new Headers(init?.headers)) {
      headers.set(name, value);
    }
    if (sessionCookie) headers.set('Cookie', sessionCookie);
    let outgoingBody = init?.body;
    if (outgoingBody instanceof BrowserFormData) {
      const entries = [...outgoingBody.entries()];
      const file = entries.find(([key]) => key === 'file')?.[1];
      if (!file || typeof file === 'string' || typeof file.arrayBuffer !== 'function') {
        throw new Error('Avatar file missing from test form');
      }
      const encoded = await encodeMultipart(file);
      outgoingBody = encoded.body;
      headers.set('Content-Type', encoded.contentType);
    }
    const outgoingRequest = new Request(url.href, { method, headers, body: outgoingBody });
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

  vi.stubGlobal('FormData', BrowserFormData);
  vi.stubGlobal('fetch', (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const response = request(input, init);
    pendingFetches.add(response);
    void response.finally(() => pendingFetches.delete(response));
    return response;
  });
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => undefined,
    removeListener: () => undefined,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    dispatchEvent: () => false,
  }));
}

async function registerDirect(email: string, name = 'Existing User'): Promise<string> {
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

function ensureTestRole(slug: string, permissionSlugs: string[]): string {
  const database = getDatabase();
  const existing = database.prepare('SELECT id FROM roles WHERE slug = ?').get(slug) as { id: string } | undefined;
  const roleId = existing?.id ?? randomUUID();
  if (!existing) {
    const now = Date.now();
    database
      .prepare(
        `INSERT INTO roles (id, name, slug, description, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(roleId, slug, slug, 'Browser test role', now, now);
  }
  const permission = database.prepare('SELECT id FROM permissions WHERE slug = ?');
  const insert = database.prepare(
    'INSERT OR IGNORE INTO role_permissions (id, role_id, permission_id, created_at) VALUES (?, ?, ?, ?)',
  );
  for (const permissionSlug of permissionSlugs) {
    const row = permission.get(permissionSlug) as { id: string } | undefined;
    if (!row) throw new Error(`Missing test permission ${permissionSlug}`);
    insert.run(randomUUID(), roleId, row.id, Date.now());
  }
  return roleId;
}

async function startAuthenticatedAdmin(email = `${randomUUID()}@example.com`): Promise<void> {
  sessionCookie = await registerDirect(email, 'Browser Administrator');
  assignRole(userIdForEmail(email), 'admin');
  await useAuthSession().refresh();
}

async function startAuthenticatedManager(email = `${randomUUID()}@example.com`): Promise<void> {
  const roleSlug = `browser-manager-${randomUUID()}`;
  ensureTestRole(roleSlug, ['users.view', 'users.edit']);
  sessionCookie = await registerDirect(email, 'Browser Manager');
  const userId = userIdForEmail(email);
  const roleId = roleIdForSlug(roleSlug);
  getDatabase()
    .prepare('INSERT INTO user_roles (id, user_id, role_id, created_at) VALUES (?, ?, ?, ?)')
    .run(randomUUID(), userId, roleId, Date.now());
  await useAuthSession().refresh();
}

async function startAuthenticatedUser(email = `${randomUUID()}@example.com`): Promise<void> {
  sessionCookie = await registerDirect(email);
  await useAuthSession().refresh();
}

async function settle(): Promise<void> {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    if (pendingFetches.size > 0) {
      await Promise.all([...pendingFetches]);
    }
    await Promise.resolve();
    await nextTick();
  }
}

function waitForNavigation(): Promise<void> {
  return new Promise((resolveNavigation) => {
    const removeHook = router.afterEach(() => {
      removeHook();
      resolveNavigation();
    });
  });
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

function setSelect(selector: string, value: string): void {
  const select = container.querySelector(selector);
  if (!(select instanceof HTMLSelectElement)) throw new Error(`Missing select ${selector}`);
  select.value = value;
  select.dispatchEvent(new Event('change', { bubbles: true }));
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

function submitForm(selector: string): void {
  const form = container.querySelector(selector);
  if (!(form instanceof HTMLFormElement)) throw new Error(`Missing form ${selector}`);
  form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
}

function chooseFile(file: TestFile): void {
  const input = container.querySelector('#avatar-file');
  if (!(input instanceof HTMLInputElement)) throw new Error('Missing avatar input');
  Object.defineProperty(input, 'files', { configurable: true, value: [file] });
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

beforeEach(async () => {
  container = document.createElement('div');
  document.body.append(container);
  application = undefined;
  sessionCookie = undefined;
  fetchRequests = [];
  fetchUrls = [];
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

describe('users browser surfaces', () => {
  it('redirects guests from protected account routes', async () => {
    await mountAt('/profile');

    expect(router.currentRoute.value.name).toBe('login');
    expect(router.currentRoute.value.query.redirect).toBe('/profile');
  });

  it('renders the authenticated shell and navigates to profile without a reload', async () => {
    await startAuthenticatedUser(`${randomUUID()}@example.com`);
    await mountAt('/dashboard');
    const documentElement = document.documentElement;

    expect(router.currentRoute.value.name).toBe('dashboard');
    expect(container.querySelector('h1')?.textContent).toContain('Welcome, Existing User.');
    expect(container.querySelector('nav[aria-label="Application navigation"]')).not.toBeNull();
    expect(container.querySelector('a[href="/dashboard"]')?.textContent).toContain('Dashboard');
    expect(container.querySelector('a[href="/profile"]')?.textContent).toContain('Profile');

    const navigation = waitForNavigation();
    container.querySelector<HTMLAnchorElement>('a[href="/profile"]')?.click();
    await navigation;
    await settle();

    expect(router.currentRoute.value.name).toBe('profile');
    expect(container.querySelector('h1')?.textContent).toContain('Your profile');
    expect(document.documentElement).toBe(documentElement);
  });

  it('loads and saves the current profile through the users Feature client', async () => {
    const email = `${randomUUID()}@example.com`;
    await startAuthenticatedUser(email);
    await mountAt('/profile');
    await settle();

    expect(container.querySelector<HTMLInputElement>('#name')?.value).toBe('Existing User');
    expect(container.querySelector<HTMLInputElement>('#email')?.value).toBe(email);

    const updatedEmail = `${randomUUID()}@example.com`;
    setInput('#name', 'Updated User');
    setInput('#email', updatedEmail);
    submitForm('[data-testid="profile-form"]');
    await settle();

    expect(container.textContent).toContain('Profile changes saved.');
    expect(useAuthSession().user.value).toMatchObject({ name: 'Updated User', email: updatedEmail });
    expect(fetchRequests).toContainEqual({ method: 'PATCH', path: '/api/users/me' });

    const response = await serverApp.request('/api/users/me', { headers: { Cookie: sessionCookie! } });
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      data: { user: { name: 'Updated User', email: updatedEmail } },
    });
  });

  it('shows profile validation errors without sending invalid input', async () => {
    await startAuthenticatedUser();
    await mountAt('/profile');
    await settle();
    const profileRequestsBeforeSubmit = fetchRequests.filter(({ path }) => path === '/api/users/me').length;

    setInput('#name', 'A');
    setInput('#email', 'invalid');
    submitForm('[data-testid="profile-form"]');
    await settle();

    expect(container.querySelector('[role="alert"]')?.textContent).toContain('Please correct');
    expect(container.textContent).toContain('Name must be at least 2 characters');
    expect(container.textContent).toContain('Invalid email format');
    expect(fetchRequests.filter(({ path }) => path === '/api/users/me')).toHaveLength(profileRequestsBeforeSubmit);
  });

  it('changes the password, preserves the session, and reports server failures', async () => {
    await startAuthenticatedUser();
    await mountAt('/profile');
    await settle();

    setInput('#current_password', 'wrong password');
    setInput('#new_password', 'new correct horse battery staple');
    setInput('#confirm_password', 'new correct horse battery staple');
    submitForm('[data-testid="password-form"]');
    await settle();

    expect(container.querySelector('[role="alert"]')?.textContent).toContain('Current password is incorrect');
    expect(router.currentRoute.value.name).toBe('profile');

    setInput('#current_password', TEST_PASSWORD);
    submitForm('[data-testid="password-form"]');
    await settle();

    expect(container.querySelector('[role="status"]')?.textContent).toContain('Password updated');
    expect(useAuthSession().isAuthenticated.value).toBe(true);
    expect(fetchRequests).toContainEqual({ method: 'POST', path: '/api/auth/change-password' });
  });

  it('validates and displays uploaded avatars through the users Feature', async () => {
    await startAuthenticatedUser();
    await mountAt('/profile');
    await settle();

    chooseFile(new NodeFile(['not an image'], 'avatar.txt', { type: 'text/plain' }));
    await settle();
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('Choose a JPEG, PNG, GIF, or WebP image');
    expect(fetchRequests.filter(({ path }) => path === '/api/assets/avatar')).toHaveLength(0);

    chooseFile(new NodeFile([ONE_PIXEL_PNG], 'avatar.png', { type: 'image/png' }));
    await settle();
    const avatar = container.querySelector<HTMLImageElement>('[data-testid="profile-avatar"]');
    expect(avatar?.getAttribute('src')).toMatch(/^\/api\/assets\/avatar\/[a-f0-9-]+\.webp$/i);
    expect(container.textContent).toContain('Profile photo updated.');
    expect(fetchRequests).toContainEqual({ method: 'POST', path: '/api/assets/avatar' });

    const filename = avatar?.getAttribute('src')?.split('/').pop();
    if (filename) await rm(resolve(process.cwd(), 'storage', 'avatars', filename), { force: true });
  });

  it('changes landing calls to match the current session', async () => {
    await mountAt('/');
    expect(container.querySelector('a[href="/register"]')?.textContent).toContain('Begin');

    await startAuthenticatedUser();
    await router.push('/');
    await router.isReady();
    await nextTick();

    expect(container.querySelector('a[href="/dashboard"]')?.textContent).toContain('Dashboard');
    expect([...container.querySelectorAll('a[href="/dashboard"]')].some((link) => link.textContent?.includes('Open dashboard'))).toBe(true);
  });

  it('logs out from the shell and protects account routes again', async () => {
    await startAuthenticatedUser();
    await mountAt('/dashboard');

    const navigation = waitForNavigation();
    container.querySelector<HTMLButtonElement>('button')?.click();
    await navigation;

    expect(router.currentRoute.value.name).toBe('login');
    expect(useAuthSession().status.value).toBe('unauthenticated');
    await router.push('/profile');
    await router.isReady();
    expect(router.currentRoute.value.name).toBe('login');
    expect(router.currentRoute.value.query.redirect).toBe('/profile');
  });
});

describe('users administration browser surfaces', () => {
  it('shows administration navigation only for users with view permissions', async () => {
    await startAuthenticatedAdmin();
    await mountAt('/dashboard');
    await settle();
    expect(useAuthSession().user.value?.roles).toContain('admin');
    expect(useAuthSession().user.value?.permissions).toEqual(expect.arrayContaining(['users.view', 'roles.view']));

    expect(container.querySelector('a[href="/users"]')?.textContent).toContain('Users');
    expect(container.querySelector('a[href="/roles"]')?.textContent).toContain('Roles');
  });

  it('redirects restricted users away from administration routes', async () => {
    await startAuthenticatedUser();
    await mountAt('/dashboard');
    await settle();

    expect(container.querySelector('a[href="/users"]')).toBeNull();
    expect(container.querySelector('a[href="/roles"]')).toBeNull();

    await router.push('/users');
    await router.isReady();
    expect(router.currentRoute.value.name).toBe('dashboard');
    expect(container.querySelector('[data-testid="user-list"]')).toBeNull();

    await router.push('/roles');
    await router.isReady();
    expect(router.currentRoute.value.name).toBe('dashboard');
    expect(container.querySelector('[data-testid="role-list"]')).toBeNull();
  });

  it('uses server search and pagination responses for the users list', async () => {
    const searchTerm = `Searchable-${randomUUID()}`;
    await startAuthenticatedAdmin();
    await registerDirect(`${randomUUID()}@example.com`, `${searchTerm} One`);
    await registerDirect(`${randomUUID()}@example.com`, `${searchTerm} Two`);
    await registerDirect(`${randomUUID()}@example.com`, `${searchTerm} Three`);

    await mountAt('/users');
    await settle();
    setInput('#user-search', searchTerm);
    submitForm('[data-testid="user-search-form"]');
    await settle();

    expect(fetchUrls.some((url) => url.includes(`/api/users?page=1&limit=10&search=${encodeURIComponent(searchTerm)}`))).toBe(true);
    expect(container.querySelector('[data-testid="user-list"]')?.textContent).toContain(`${searchTerm} One`);
    expect(container.querySelector('[data-testid="user-list"]')?.textContent).toContain(`${searchTerm} Three`);

    setSelect('#user-page-size', '1');
    await settle();
    expect(container.textContent).toContain('Page 1 of 3');
    await click('[data-testid="user-next"]');
    await settle();

    expect(fetchUrls.some((url) => url.includes(`/api/users?page=2&limit=1&search=${encodeURIComponent(searchTerm)}`))).toBe(true);
    expect(container.textContent).toContain('Page 2 of 3');
  });

  it('creates users, validates input, and assigns a role while editing', async () => {
    const email = `${randomUUID()}@example.com`;
    await startAuthenticatedAdmin();
    await mountAt('/users');
    await settle();

    await click('[data-testid="create-user"]');
    setInput('#user-name', 'A');
    setInput('#user-email', 'invalid');
    const postCountBeforeInvalidSubmit = fetchRequests.filter(({ method, path }) => method === 'POST' && path === '/api/users').length;
    submitForm('[data-testid="user-form"]');
    await settle();
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('Please correct');
    expect(fetchRequests.filter(({ method, path }) => method === 'POST' && path === '/api/users')).toHaveLength(postCountBeforeInvalidSubmit);

    setInput('#user-name', 'Created Browser User');
    setInput('#user-email', email);
    setInput('#user-password', 'managed-password');
    submitForm('[data-testid="user-form"]');
    await settle();

    expect(fetchRequests).toContainEqual({ method: 'POST', path: '/api/users' });
    const createdRow = tableRowContaining(email);
    const userId = createdRow.dataset.userId;
    if (!userId) throw new Error('Created user row did not expose its id');
    expect(createdRow.textContent).toContain('No roles');

    await click(`[data-testid="edit-user-${userId}"]`);
    setInput('#user-name', 'Updated Browser User');
    await click('[data-role-slug="user"]');
    submitForm('[data-testid="user-form"]');
    await settle();

    const updatedRow = tableRowContaining(email);
    expect(updatedRow.textContent).toContain('Updated Browser User');
    expect(updatedRow.textContent).toContain('User');
    expect(fetchRequests).toContainEqual({ method: 'PUT', path: `/api/users/${userId}` });

    const response = await serverApp.request(`/api/users?search=${encodeURIComponent(email)}`, { headers: { Cookie: sessionCookie! } });
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      data: { users: [{ email, roles: ['user'] }] },
    });

    const selfRow = tableRowContaining('Browser Administrator');
    const selfId = selfRow.dataset.userId;
    if (!selfId) throw new Error('Administrator row did not expose its id');
    await click(`[data-testid="edit-user-${selfId}"]`);
    await click('[data-role-slug="admin"]');
    submitForm('[data-testid="user-form"]');
    await settle();
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('Cannot remove admin role from yourself');
    expect(useAuthSession().isAuthenticated.value).toBe(true);
  });

  it('hides role controls for a manager and reports forbidden role assignment', async () => {
    await startAuthenticatedManager();
    const targetEmail = `${randomUUID()}@example.com`;
    await registerDirect(targetEmail, 'Manager Target');
    await mountAt('/users');
    await settle();

    expect(container.querySelector('[data-testid="create-user"]')).toBeNull();
    const row = tableRowContaining(targetEmail);
    const targetId = row.dataset.userId;
    if (!targetId) throw new Error('Manager target row did not expose its id');
    await click(`[data-testid="edit-user-${targetId}"]`);
    expect(container.querySelector('[data-role-slug]')).toBeNull();

    const response = await createUsersClient().updateUser(targetId, { roles: ['user'] });
    expect(response).toMatchObject({
      success: false,
      code: 'FORBIDDEN',
      message: 'Forbidden',
    });
  });

  it('deletes allowed users and surfaces self-delete protection', async () => {
    await startAuthenticatedAdmin();
    const targetEmail = `${randomUUID()}@example.com`;
    await registerDirect(targetEmail, 'Delete Me');
    await mountAt('/users');
    await settle();

    const targetRow = tableRowContaining(targetEmail);
    const targetId = targetRow.dataset.userId;
    if (!targetId) throw new Error('Delete target row did not expose its id');
    await click(`[data-testid="delete-user-${targetId}"]`);
    await click('[data-testid="confirm-delete"]');
    await settle();
    expect(container.querySelector(`tr[data-user-id="${targetId}"]`)).toBeNull();
    expect(fetchRequests).toContainEqual({ method: 'DELETE', path: '/api/users' });

    const selfRow = tableRowContaining('Browser Administrator');
    const selfId = selfRow.dataset.userId;
    if (!selfId) throw new Error('Administrator row did not expose its id');
    await click(`[data-testid="delete-user-${selfId}"]`);
    await click('[data-testid="confirm-delete"]');
    await settle();
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('Cannot delete your own account');
    expect(useAuthSession().isAuthenticated.value).toBe(true);
  });

  it('surfaces last-admin protection through the users browser client', async () => {
    const adminRoleId = roleIdForSlug('admin');
    getDatabase().prepare('DELETE FROM user_roles WHERE role_id = ?').run(adminRoleId);

    const managerRoleSlug = `browser-delete-manager-${randomUUID()}`;
    ensureTestRole(managerRoleSlug, ['users.view', 'users.delete']);
    const managerEmail = `${randomUUID()}@example.com`;
    const managerCookie = await registerDirect(managerEmail, 'Delete Manager');
    const managerId = userIdForEmail(managerEmail);
    getDatabase()
      .prepare('INSERT INTO user_roles (id, user_id, role_id, created_at) VALUES (?, ?, ?, ?)')
      .run(randomUUID(), managerId, roleIdForSlug(managerRoleSlug), Date.now());

    const adminEmail = `${randomUUID()}@example.com`;
    await registerDirect(adminEmail, 'Sole Administrator');
    const adminId = userIdForEmail(adminEmail);
    assignRole(adminId, 'admin');

    sessionCookie = managerCookie;
    await useAuthSession().refresh();
    const response = await createUsersClient().deleteUsers({ ids: [adminId] });

    expect(response).toMatchObject({
      success: false,
      code: 'LAST_ADMIN',
      message: 'Cannot delete the last admin',
    });
  });
});
