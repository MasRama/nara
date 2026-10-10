// @vitest-environment node
import { createHash, randomUUID } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { Hono } from 'hono';
import { getCookie } from 'hono/cookie';
import { afterEach, describe, expect, it } from 'vitest';
import { getDatabase } from '../../../shared/database';
import { closeEventStreams, createEventStream, STREAM_READY_EVENT } from '../../../shared/realtime';
import { readEvents, type EventReader } from '../../../shared/realtime/tests/helpers';
import { createAssetRoutes, createUserRoutes, usersAccess, type UsersServerHost } from '../index';
import { describeUsersHost } from './host-conformance';

const ONE_PIXEL_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
);

/**
 * Isolated alternative provider: a small in-memory identity and
 * authorization implementation with its own vocabulary. It shares no code
 * with the Auth Feature and touches no Auth-owned storage; if Users reaches
 * past this host — through an import or through SQL on account rows — these
 * tests fail.
 */
/** The mock provider's own password hash; like any provider's, it never contains the password. */
function mockHash(password: string): string {
  return `mock-hash:${createHash('sha256').update(password).digest('hex')}`;
}

interface MockAccount {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  avatar: string | null;
  revision: number;
}

interface MockHostState {
  actors: Map<string, string>;
  permissions: Map<string, Set<string>>;
  roles: Array<{ id: string; slug: string; administrator: boolean }>;
  assignments: Map<string, string[]>;
  accounts: Map<string, MockAccount>;
  storage: Map<string, { data: Uint8Array; contentType: string }>;
}

function createMockHost(cookieName = 'mock_session'): { host: UsersServerHost; state: MockHostState } {
  const state: MockHostState = {
    actors: new Map(),
    permissions: new Map(),
    roles: [
      { id: 'mock-role-admin', slug: 'admin', administrator: true },
      { id: 'mock-role-user', slug: 'user', administrator: false },
    ],
    assignments: new Map(),
    accounts: new Map(),
    storage: new Map(),
  };
  const isAdministrator = (accountId: string) =>
    (state.assignments.get(accountId) ?? []).some((roleId) => state.roles.find((role) => role.id === roleId)?.administrator);
  const visible = (account: MockAccount) => ({
    id: account.id,
    name: account.name,
    email: account.email,
    avatar: account.avatar,
    revision: account.revision,
  });
  const host: UsersServerHost = {
    sessionCookieName: cookieName,
    assetStorage: {
      put: async ({ key, data, contentType }) => {
        if (state.storage.has(key)) throw new Error(`Duplicate storage key: ${key}`);
        state.storage.set(key, { data: new Uint8Array(data), contentType });
      },
      get: async (key) => {
        const stored = state.storage.get(key);
        return stored
          ? { data: new Uint8Array(stored.data), size: stored.data.byteLength }
          : undefined;
      },
      delete: async (key) => state.storage.delete(key),
    },
    resolveActor: (sessionToken) => {
      const id = sessionToken ? state.actors.get(sessionToken) : undefined;
      if (!id) return undefined;
      const account = state.accounts.get(id);
      return account ? { id: account.id, avatar: account.avatar } : undefined;
    },
    hashPassword: async (password) => mockHash(password),
    findAccountById: (userId) => {
      const account = state.accounts.get(userId);
      return account ? visible(account) : undefined;
    },
    listAccounts: (page, limit, search = '') => {
      const normalizedPage = Math.max(1, page);
      const normalizedLimit = Math.max(1, Math.min(100, limit));
      const needle = search.toLowerCase();
      const matching = [...state.accounts.values()]
        .filter((account) => account.name.toLowerCase().includes(needle) || account.email.toLowerCase().includes(needle))
        .map(visible);
      return {
        data: matching.slice((normalizedPage - 1) * normalizedLimit, normalizedPage * normalizedLimit),
        total: matching.length,
      };
    },
    createAccount: (input, roleIds) => {
      for (const account of state.accounts.values()) {
        if (account.email.toLowerCase() === input.email.toLowerCase()) return { status: 'duplicate-email' };
      }
      const account: MockAccount = {
        id: input.id,
        name: input.name,
        email: input.email,
        passwordHash: input.passwordHash,
        avatar: null,
        revision: 1,
      };
      state.accounts.set(account.id, account);
      if (roleIds !== undefined) state.assignments.set(account.id, [...roleIds]);
      return { status: 'created', account: visible(account) };
    },
    updateAccount: (userId, patch, options = {}) => {
      const account = state.accounts.get(userId);
      if (!account) return { status: 'missing' };
      if (options.revision !== undefined && options.revision !== account.revision) {
        return { status: 'stale', account: visible(account) };
      }
      if (patch.email !== undefined) {
        for (const other of state.accounts.values()) {
          if (other.id !== userId && other.email.toLowerCase() === patch.email.toLowerCase()) return { status: 'duplicate-email' };
        }
        account.email = patch.email;
      }
      if (patch.name !== undefined) account.name = patch.name;
      if (patch.avatar !== undefined) account.avatar = patch.avatar;
      if (options.roleIds !== undefined) state.assignments.set(userId, [...options.roleIds]);
      account.revision += 1;
      return { status: 'updated', account: visible(account) };
    },
    resetPassword: (userId, passwordHash) => {
      const account = state.accounts.get(userId);
      if (!account) return undefined;
      account.passwordHash = passwordHash;
      for (const [token, actorId] of state.actors) {
        if (actorId === userId) state.actors.delete(token);
      }
      return visible(account);
    },
    deleteAccounts: (userIds) => {
      let removed = 0;
      for (const userId of userIds) {
        if (state.accounts.delete(userId)) removed += 1;
      }
      return removed;
    },
    access: usersAccess('users'),
    allows: (actorId, rule) =>
      isAdministrator(actorId) || ('permission' in rule && (state.permissions.get(actorId)?.has(rule.permission) ?? false)),
    availableRoles: () => state.roles.map((role) => ({ ...role })),
    rolesForUser: (userId) =>
      (state.assignments.get(userId) ?? []).map((id) => state.roles.find((role) => role.id === id)?.slug ?? id),
    administrators: () => [...state.accounts.keys()].filter(isAdministrator).map((id) => ({ id })),
  };
  return { host, state };
}

function seedAccount(
  host: UsersServerHost,
  overrides: { name?: string; email?: string; password?: string } = {},
): { id: string; email: string } {
  const created = host.createAccount({
    id: randomUUID(),
    name: overrides.name ?? 'Mock User',
    email: overrides.email ?? `${randomUUID()}@example.com`,
    passwordHash: mockHash(overrides.password ?? `password-${randomUUID()}`),
  });
  if (created.status !== 'created') throw new Error('Seed email already in use');
  return { id: created.account.id, email: created.account.email };
}

function loginAs(state: MockHostState, userId: string, options: { admin?: boolean; permissions?: string[] } = {}): string {
  const token = randomUUID();
  state.actors.set(token, userId);
  // Administrators are whoever holds an administrator role, as the host contract says.
  if (options.admin && !(state.assignments.get(userId) ?? []).includes('mock-role-admin')) {
    state.assignments.set(userId, [...(state.assignments.get(userId) ?? []), 'mock-role-admin']);
  }
  if (options.permissions) state.permissions.set(userId, new Set(options.permissions));
  return `${token}`;
}

function buildApp(host: UsersServerHost): Hono {
  return new Hono().route('/api/users', createUserRoutes(host)).route('/api/assets', createAssetRoutes(host));
}

async function listen(app: Hono, cookie: string): Promise<EventReader> {
  const response = await app.request('/events', { headers: { Cookie: cookie } });
  expect(response.status).toBe(200);
  const events = readEvents(response);
  expect(await events.next()).toBe(STREAM_READY_EVENT);
  return events;
}

/** Every event that arrives until the stream stays quiet. */
async function drain(events: EventReader, quietMs = 100): Promise<string[]> {
  const received: string[] = [];
  for (let event = await events.next(quietMs); event !== 'timeout'; event = await events.next(quietMs)) received.push(event);
  return received;
}

function cookieFor(host: UsersServerHost, token: string): string {
  return `${host.sessionCookieName}=${token}`;
}

async function jsonRequest(
  app: Hono,
  path: string,
  init: { method?: string; cookie?: string; body?: unknown } = {},
): Promise<{ status: number; payload: unknown }> {
  const response = await app.request(path, {
    method: init.method ?? 'GET',
    headers: {
      ...(init.cookie ? { Cookie: init.cookie } : {}),
      ...(init.body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  return { status: response.status, payload: await response.json() };
}

function collectSourceFiles(directory: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.name === 'tests' || entry.name === 'node_modules') continue;
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...collectSourceFiles(full));
    else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.vue'))) files.push(full);
  }
  return files;
}

function importSpecifiers(source: string): string[] {
  const specifiers: string[] = [];
  const staticPattern = /(?:import|export)[^'"]*?from\s*['"]([^'"]+)['"]/g;
  const dynamicPattern = /(?:import|require)\(\s*['"]([^'"]+)['"]\s*\)/g;
  for (const pattern of [staticPattern, dynamicPattern]) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(source)) !== null) specifiers.push(match[1]);
  }
  return specifiers;
}

function isAuthSpecifier(specifier: string): boolean {
  return (
    specifier === 'auth' ||
    specifier.endsWith('/auth') ||
    specifier.includes('/auth/') ||
    specifier.includes('features/auth')
  );
}

function accountTableReferences(source: string): string[] {
  const found: string[] = [];
  const pattern = /\b(?:FROM|INTO|UPDATE|JOIN)\s+users\b/i;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(source)) !== null) found.push(match[0]);
  return found;
}

describe('users host requirements with an alternative provider', () => {
  afterEach(() => {
    closeEventStreams();
  });

  it('exposes route factories built from an explicit host value', () => {
    const { host } = createMockHost();
    expect(typeof createUserRoutes).toBe('function');
    expect(typeof createAssetRoutes).toBe('function');
    expect(buildApp(host)).toBeDefined();
  });

  it('contains no direct Auth import in feature-owned source', () => {
    const featureDirectory = path.resolve(__dirname, '..');
    const offenders: string[] = [];
    for (const file of collectSourceFiles(featureDirectory)) {
      const found = importSpecifiers(readFileSync(file, 'utf8')).filter(isAuthSpecifier);
      if (found.length > 0) offenders.push(`${path.relative(featureDirectory, file)}: ${found.join(', ')}`);
    }
    expect(offenders).toEqual([]);
  });

  it('never queries Auth-owned account rows with SQL', () => {
    const featureDirectory = path.resolve(__dirname, '..');
    const offenders: string[] = [];
    for (const file of collectSourceFiles(featureDirectory)) {
      const found = accountTableReferences(readFileSync(file, 'utf8'));
      if (found.length > 0) offenders.push(`${path.relative(featureDirectory, file)}: ${found.join(', ')}`);
    }
    expect(offenders).toEqual([]);
  });

  it('rejects anonymous requests across user and asset surfaces', async () => {
    const { host } = createMockHost();
    const app = buildApp(host);
    for (const [routePath, method, body] of [
      ['/api/users/me', 'GET', undefined],
      ['/api/users', 'GET', undefined],
      ['/api/users', 'POST', {}],
      ['/api/users', 'DELETE', { ids: [randomUUID()] }],
    ] as const) {
      const { status, payload } = await jsonRequest(app, routePath, { method, body });
      expect(status).toBe(401);
      expect(payload).toMatchObject({ success: false, code: 'UNAUTHORIZED' });
    }
    const avatarResponse = await app.request('/api/assets/avatar', { method: 'POST', body: new FormData() });
    expect(avatarResponse.status).toBe(401);
  });

  it('enforces forbidden behavior through the supplied host', async () => {
    const { host, state } = createMockHost();
    const app = buildApp(host);
    const { id } = seedAccount(host);
    const cookie = cookieFor(host, loginAs(state, id));

    const listed = await jsonRequest(app, '/api/users', { cookie });
    expect(listed.status).toBe(403);
    expect(listed.payload).toMatchObject({ success: false, code: 'FORBIDDEN' });

    const created = await jsonRequest(app, '/api/users', {
      method: 'POST',
      cookie,
      body: { name: 'New User', email: `${randomUUID()}@example.com`, password: 'long enough password' },
    });
    expect(created.status).toBe(403);
  });

  it('grants viewer permission without granting management', async () => {
    const { host, state } = createMockHost();
    const app = buildApp(host);
    const { id } = seedAccount(host);
    const cookie = cookieFor(host, loginAs(state, id, { permissions: ['users.view'] }));

    const listed = await jsonRequest(app, '/api/users', { cookie });
    expect(listed.status).toBe(200);

    const deleted = await jsonRequest(app, '/api/users', { method: 'DELETE', cookie, body: { ids: [randomUUID()] } });
    expect(deleted.status).toBe(403);
  });

  it('normalizes pagination once at the route boundary', async () => {
    const { host, state } = createMockHost();
    const originalListAccounts = host.listAccounts;
    let received: { page: number; limit: number } | undefined;
    host.listAccounts = (page, limit, search) => {
      received = { page, limit };
      return originalListAccounts(page, limit, search);
    };
    const app = buildApp(host);
    const { id } = seedAccount(host);
    const cookie = cookieFor(host, loginAs(state, id, { permissions: ['users.view'] }));

    const listed = await jsonRequest(app, '/api/users?page=0&limit=500', { cookie });
    expect(listed.status).toBe(200);
    expect(received).toEqual({ page: 1, limit: 100 });
    expect(listed.payload).toMatchObject({ data: { page: 1, limit: 100 } });

    const extreme = await jsonRequest(app, '/api/users?page=999999999999999999999999&limit=999999999999999999', { cookie });
    expect(extreme.status).toBe(200);
    expect(received).toEqual({ page: 1_000_000, limit: 100 });
    expect(extreme.payload).toMatchObject({ data: { page: 1_000_000, limit: 100 } });
  });

  it('creates users through host password hashing and role assignment', async () => {
    const { host, state } = createMockHost();
    const app = buildApp(host);
    const { id: adminId } = seedAccount(host);
    const cookie = cookieFor(host, loginAs(state, adminId, { admin: true }));

    const email = `${randomUUID()}@example.com`;
    const created = await jsonRequest(app, '/api/users', {
      method: 'POST',
      cookie,
      body: { name: 'Managed User', email, password: 'correct horse battery staple', roles: ['user'] },
    });
    expect(created.status).toBe(201);
    const userId = (created.payload as { data: { user: { id: string; roles: string[] } } }).data.user.id;
    expect((created.payload as { data: { user: { roles: string[] } } }).data.user.roles).toEqual(['user']);

    expect(state.accounts.get(userId)?.passwordHash).toBe(mockHash('correct horse battery staple'));
    expect(state.assignments.get(userId)).toEqual(['mock-role-user']);

    const listed = await jsonRequest(app, '/api/users', { cookie });
    expect(listed.status).toBe(200);
    expect(listed.payload).toMatchObject({
      data: { users: expect.arrayContaining([expect.objectContaining({ id: userId, roles: ['user'] })]) },
    });
  });

  it('rejects unknown role slugs before creating or updating accounts', async () => {
    const { host, state } = createMockHost();
    const app = buildApp(host);
    const { id: adminId } = seedAccount(host);
    const cookie = cookieFor(host, loginAs(state, adminId, { admin: true }));
    const email = `${randomUUID()}@example.com`;

    const created = await jsonRequest(app, '/api/users', {
      method: 'POST',
      cookie,
      body: { name: 'Unknown Role', email, password: 'correct horse battery staple', roles: ['missing-role'] },
    });
    expect(created.status).toBe(422);
    expect(created.payload).toMatchObject({ code: 'VALIDATION_ERROR', errors: { roles: ['Unknown role: missing-role'] } });
    expect([...state.accounts.values()].some((account) => account.email === email)).toBe(false);

    const { id: targetId } = seedAccount(host);
    const before = state.assignments.get(targetId);
    const updated = await jsonRequest(app, `/api/users/${targetId}`, {
      method: 'PUT',
      cookie,
      body: { revision: 1, roles: ['missing-role'] },
    });
    expect(updated.status).toBe(422);
    expect(state.assignments.get(targetId)).toEqual(before);
  });

  it('answers duplicate emails the host reports', async () => {
    const { host, state } = createMockHost();
    const app = buildApp(host);
    const email = `${randomUUID()}@example.com`;
    seedAccount(host, { email });
    const { id: adminId } = seedAccount(host);
    const cookie = cookieFor(host, loginAs(state, adminId, { admin: true }));

    const created = await jsonRequest(app, '/api/users', {
      method: 'POST',
      cookie,
      body: { name: 'Duplicate User', email: email.toUpperCase(), password: 'correct horse battery staple' },
    });
    expect(created.status).toBe(409);
    expect(created.payload).toMatchObject({ success: false, code: 'DUPLICATE_EMAIL' });
  });

  it('reports duplicate email conflicts for profile and managed-user updates', async () => {
    const { host, state } = createMockHost();
    const app = buildApp(host);
    const { id: firstId } = seedAccount(host);
    const { id: secondId, email: secondEmail } = seedAccount(host);
    const firstCookie = cookieFor(host, loginAs(state, firstId));

    const profile = await jsonRequest(app, '/api/users/me', {
      method: 'PATCH',
      cookie: firstCookie,
      body: { revision: 1, name: 'Conflicting Profile', email: secondEmail },
    });
    expect(profile.status).toBe(409);
    expect(profile.payload).toMatchObject({ success: false, code: 'DUPLICATE_EMAIL' });

    const { id: adminId } = seedAccount(host);
    const adminCookie = cookieFor(host, loginAs(state, adminId, { admin: true }));
    const managed = await jsonRequest(app, `/api/users/${firstId}`, {
      method: 'PUT',
      cookie: adminCookie,
      body: { revision: 1, email: secondEmail },
    });
    expect(managed.status).toBe(409);
    expect(managed.payload).toMatchObject({ success: false, code: 'DUPLICATE_EMAIL' });
    expect(state.accounts.get(firstId)?.email).not.toBe(state.accounts.get(secondId)?.email);
  });

  it('refuses role assignment without host trust and keeps passwords stable on edit', async () => {
    const { host, state } = createMockHost();
    const app = buildApp(host);
    const { id: managerId } = seedAccount(host);
    const cookie = cookieFor(
      host,
      loginAs(state, managerId, { permissions: ['users.create', 'users.edit'] }),
    );

    const email = `${randomUUID()}@example.com`;
    const refused = await jsonRequest(app, '/api/users', {
      method: 'POST',
      cookie,
      body: { name: 'Managed User', email, password: 'correct horse battery staple', roles: ['user'] },
    });
    expect(refused.status).toBe(403);

    const { id: targetId } = seedAccount(host);
    const before = state.accounts.get(targetId)?.passwordHash;
    const updated = await jsonRequest(app, `/api/users/${targetId}`, {
      method: 'PUT',
      cookie,
      body: { revision: 1, name: 'Renamed User' },
    });
    expect(updated.status).toBe(200);
    expect(state.accounts.get(targetId)?.passwordHash).toBe(before);
  });

  it('separates profile edits from credential reset and blocks delegated account takeover', async () => {
    const { host, state } = createMockHost();
    const app = buildApp(host);
    const { id: managerId } = seedAccount(host);
    const { id: targetId, email: targetEmail } = seedAccount(host);
    const managerCookie = cookieFor(host, loginAs(state, managerId, { permissions: ['users.edit'] }));
    const targetToken = loginAs(state, targetId);
    const beforeHash = state.accounts.get(targetId)?.passwordHash;

    const emailTakeover = await jsonRequest(app, `/api/users/${targetId}`, {
      method: 'PUT',
      cookie: managerCookie,
      body: { revision: 1, email: `${randomUUID()}@example.com` },
    });
    expect(emailTakeover.status).toBe(403);
    expect(state.accounts.get(targetId)?.email).toBe(targetEmail);

    const passwordViaEdit = await jsonRequest(app, `/api/users/${targetId}`, {
      method: 'PUT',
      cookie: managerCookie,
      body: { revision: 1, password: 'new delegated password' },
    });
    expect(passwordViaEdit.status).toBe(422);
    expect(state.accounts.get(targetId)?.passwordHash).toBe(beforeHash);

    const selfCookie = cookieFor(host, targetToken);
    const selfBypass = await jsonRequest(app, `/api/users/${targetId}`, {
      method: 'PUT',
      cookie: selfCookie,
      body: { revision: 1, password: 'self bypass password' },
    });
    expect(selfBypass.status).toBe(422);
    expect(state.accounts.get(targetId)?.passwordHash).toBe(beforeHash);

    state.permissions.set(managerId, new Set(['users.edit', 'users.reset-password']));
    const reset = await jsonRequest(app, `/api/users/${targetId}/reset-password`, {
      method: 'POST',
      cookie: managerCookie,
      body: { password: 'explicit reset password' },
    });
    expect(reset.status).toBe(200);
    expect(state.accounts.get(targetId)?.passwordHash).toBe(mockHash('explicit reset password'));
    expect(state.actors.has(targetToken)).toBe(false);
  });

  it('protects administrator accounts from delegated users.edit and reset-password', async () => {
    const { host, state } = createMockHost();
    const app = buildApp(host);
    const { id: managerId } = seedAccount(host);
    const { id: adminId } = seedAccount(host);
    state.assignments.set(adminId, ['mock-role-admin']);
    const cookie = cookieFor(
      host,
      loginAs(state, managerId, { permissions: ['users.edit', 'users.reset-password'] }),
    );

    const edit = await jsonRequest(app, `/api/users/${adminId}`, { method: 'PUT', cookie, body: { revision: 1, name: 'Taken Over' } });
    expect(edit.status).toBe(403);
    expect(edit.payload).toMatchObject({ code: 'PROTECTED_ADMIN' });

    const reset = await jsonRequest(app, `/api/users/${adminId}/reset-password`, {
      method: 'POST',
      cookie,
      body: { password: 'should never apply' },
    });
    expect(reset.status).toBe(403);
    expect(reset.payload).toMatchObject({ code: 'PROTECTED_ADMIN' });
  });

  it('protects the last admin and self-demotion through host role state', async () => {
    const { host, state } = createMockHost();
    const app = buildApp(host);
    const { id: adminId } = seedAccount(host);
    state.assignments.set(adminId, ['mock-role-admin']);
    const cookie = cookieFor(host, loginAs(state, adminId, { admin: true }));

    const demotion = await jsonRequest(app, `/api/users/${adminId}`, {
      method: 'PUT',
      cookie,
      body: { revision: 1, roles: ['user'] },
    });
    expect(demotion.status).toBe(400);
    expect(demotion.payload).toMatchObject({ code: 'SELF_DEMOTION' });

    const lastAdmin = await jsonRequest(app, '/api/users', {
      method: 'DELETE',
      cookie,
      body: { ids: [adminId, randomUUID()] },
    });
    expect(lastAdmin.status).toBe(400);
    expect(lastAdmin.payload).toMatchObject({ code: 'SELF_DELETE' });

    const { id: otherId } = seedAccount(host);
    const onlyAdmin = await jsonRequest(app, '/api/users', { method: 'DELETE', cookie, body: { ids: [otherId] } });
    expect(onlyAdmin.status).toBe(200);
  });

  it('honors a binding-chosen session cookie name', async () => {
    const { host, state } = createMockHost('custom_session');
    const app = buildApp(host);
    const { id } = seedAccount(host);
    const token = loginAs(state, id);

    const wrongCookie = await jsonRequest(app, '/api/users/me', { cookie: `mock_session=${token}` });
    expect(wrongCookie.status).toBe(401);

    const rightCookie = await jsonRequest(app, '/api/users/me', { cookie: cookieFor(host, token) });
    expect(rightCookie.status).toBe(200);
  });

  it('serves the avatar surface through the same host', async () => {
    const { host, state } = createMockHost();
    const app = buildApp(host);
    const { id } = seedAccount(host);
    const cookie = cookieFor(host, loginAs(state, id));

    const form = new FormData();
    form.set('file', new Blob([ONE_PIXEL_PNG], { type: 'image/png' }), 'avatar.png');
    const uploaded = await app.request('/api/assets/avatar', {
      method: 'POST',
      headers: { Cookie: cookie },
      body: form,
    });
    expect(uploaded.status).toBe(200);
    const payload = (await uploaded.json()) as { data: { url: string } };
    expect(payload.data.url).toMatch(/^\/api\/assets\/avatar\/[a-f0-9-]+\.webp$/);

    const served = await app.request(payload.data.url);
    expect(served.status).toBe(200);
    expect(state.accounts.get(id)?.avatar).toBe(payload.data.url);

    const assets = getDatabase().prepare('SELECT * FROM assets WHERE url = ?').all(payload.data.url);
    for (const asset of assets as Array<{ id: string }>) {
      getDatabase().prepare('DELETE FROM assets WHERE id = ?').run(asset.id);
    }
  });

  it('replaces avatar rows/files and cleans them when the account is deleted', async () => {
    const { host, state } = createMockHost();
    const app = buildApp(host);
    const { id: adminId } = seedAccount(host);
    state.assignments.set(adminId, ['mock-role-admin']);
    const { id: targetId } = seedAccount(host);
    const adminCookie = cookieFor(host, loginAs(state, adminId, { admin: true }));
    const targetCookie = cookieFor(host, loginAs(state, targetId));

    async function upload(): Promise<string> {
      const form = new FormData();
      form.set('file', new Blob([ONE_PIXEL_PNG], { type: 'image/png' }), 'avatar.png');
      const response = await app.request('/api/assets/avatar', { method: 'POST', headers: { Cookie: targetCookie }, body: form });
      expect(response.status).toBe(200);
      return ((await response.json()) as { data: { url: string } }).data.url;
    }

    const first = await upload();
    const second = await upload();
    expect(first).not.toBe(second);
    expect((await app.request(first)).status).toBe(404);
    expect(getDatabase().prepare('SELECT id FROM assets WHERE user_id = ?').all(targetId)).toHaveLength(1);

    const deleted = await jsonRequest(app, '/api/users', { method: 'DELETE', cookie: adminCookie, body: { ids: [targetId] } });
    expect(deleted.status).toBe(200);
    expect((await app.request(second)).status).toBe(404);
    expect(getDatabase().prepare('SELECT id FROM assets WHERE user_id = ?').all(targetId)).toEqual([]);
  });

  it('keeps concurrent avatar uploads serveable while the account settles on one winner', async () => {
    const { host, state } = createMockHost();
    const app = buildApp(host);
    const { id } = seedAccount(host);
    const cookie = cookieFor(host, loginAs(state, id));

    const upload = () => {
      const form = new FormData();
      form.set('file', new Blob([ONE_PIXEL_PNG], { type: 'image/png' }), 'avatar.png');
      return app.request('/api/assets/avatar', { method: 'POST', headers: { Cookie: cookie }, body: form });
    };

    const responses = await Promise.all([upload(), upload()]);
    expect(responses.map((response) => response.status)).toEqual([200, 200]);
    const urls = await Promise.all(
      responses.map(async (response) => ((await response.json()) as { data: { url: string } }).data.url),
    );
    expect(new Set(urls).size).toBe(2);
    expect(urls).toContain(state.accounts.get(id)?.avatar);
    for (const url of urls) expect((await app.request(url)).status).toBe(200);

    for (const url of urls) getDatabase().prepare('DELETE FROM assets WHERE url = ?').run(url);
  });

  it('compensates avatar file and row creation when account update fails', async () => {
    const { host, state } = createMockHost();
    const { id } = seedAccount(host);
    const cookie = cookieFor(host, loginAs(state, id));
    host.updateAccount = () => ({ status: 'missing' });
    const app = buildApp(host);
    const before = getDatabase().prepare('SELECT COUNT(*) AS count FROM assets WHERE user_id = ?').get(id) as { count: number };
    const form = new FormData();
    form.set('file', new Blob([ONE_PIXEL_PNG], { type: 'image/png' }), 'avatar.png');
    const response = await app.request('/api/assets/avatar', { method: 'POST', headers: { Cookie: cookie }, body: form });
    expect(response.status).toBe(400);
    const after = getDatabase().prepare('SELECT COUNT(*) AS count FROM assets WHERE user_id = ?').get(id) as { count: number };
    expect(after.count).toBe(before.count);
  });

  it('rejects invalid input through host-authorized actors without touching providers', async () => {
    const { host, state } = createMockHost();
    const app = buildApp(host);
    const { id: adminId } = seedAccount(host);
    const cookie = cookieFor(host, loginAs(state, adminId, { admin: true }));

    const created = await jsonRequest(app, '/api/users', {
      method: 'POST',
      cookie,
      body: { name: '', email: 'not-an-email' },
    });
    expect(created.status).toBe(422);
    expect(created.payload).toMatchObject({ success: false, code: 'VALIDATION_ERROR' });
  });

  it('refuses updates based on an older revision with the account as it is now', async () => {
    const { host, state } = createMockHost();
    const app = buildApp(host);
    const { id: adminId } = seedAccount(host);
    const { id: targetId } = seedAccount(host, { name: 'Before' });
    const adminCookie = cookieFor(host, loginAs(state, adminId, { admin: true }));

    const first = await jsonRequest(app, `/api/users/${targetId}`, {
      method: 'PUT',
      cookie: adminCookie,
      body: { revision: 1, name: 'First Save' },
    });
    expect(first).toMatchObject({ status: 200, payload: { data: { user: { name: 'First Save', revision: 2 } } } });

    const stale = await jsonRequest(app, `/api/users/${targetId}`, {
      method: 'PUT',
      cookie: adminCookie,
      body: { revision: 1, name: 'Stale Save', roles: ['user'] },
    });
    expect(stale.status).toBe(409);
    expect(stale.payload).toEqual({
      success: false,
      message: 'Someone else changed this account since you opened it',
      code: 'STALE_REVISION',
      current: expect.objectContaining({ id: targetId, name: 'First Save', revision: 2, roles: [] }),
    });
    expect(state.accounts.get(targetId)?.name).toBe('First Save');
    expect(state.assignments.get(targetId)).toBeUndefined();

    const profile = await jsonRequest(app, '/api/users/me', {
      method: 'PATCH',
      cookie: cookieFor(host, loginAs(state, targetId)),
      body: { revision: 1, name: 'Own Stale', email: state.accounts.get(targetId)!.email },
    });
    expect(profile.status).toBe(409);
    expect(profile.payload).toMatchObject({ code: 'STALE_REVISION', current: { name: 'First Save', revision: 2 } });
    expect(profile.payload).not.toHaveProperty('current.roles');
  });

  it('announces changes and editors to whoever may view users, and changes to the account itself', async () => {
    const { host, state } = createMockHost();
    const app = buildApp(host).get(
      '/events',
      createEventStream({
        resolve: (context) => {
          const token = getCookie(context, host.sessionCookieName);
          const userId = token === undefined ? undefined : state.actors.get(token);
          return userId === undefined ? undefined : { userId, sessionId: token! };
        },
      }),
    );
    const { id: adminId } = seedAccount(host, { name: 'Ada Admin' });
    state.assignments.set(adminId, ['mock-role-admin']);
    const adminCookie = cookieFor(host, loginAs(state, adminId, { admin: true }));
    const { id: targetId } = seedAccount(host);
    const targetCookie = cookieFor(host, loginAs(state, targetId));
    const viewerCookie = cookieFor(host, loginAs(state, seedAccount(host).id, { permissions: ['users.view'] }));
    const bystanderCookie = cookieFor(host, loginAs(state, seedAccount(host).id));
    const [target, viewer, bystander] = await Promise.all([targetCookie, viewerCookie, bystanderCookie].map((cookie) => listen(app, cookie)));

    expect((await jsonRequest(app, `/api/users/${targetId}/editing`, { method: 'PUT', cookie: adminCookie })).status).toBe(200);
    expect(await drain(viewer)).toEqual(['users.editing']);
    expect(await jsonRequest(app, '/api/users/editing', { cookie: viewerCookie })).toMatchObject({
      status: 200,
      payload: { data: { editing: { [targetId]: [{ id: adminId, name: 'Ada Admin' }] } } },
    });
    expect((await jsonRequest(app, `/api/users/${randomUUID()}/editing`, { method: 'PUT', cookie: adminCookie })).status).toBe(404);

    expect((await jsonRequest(app, `/api/users/${targetId}`, { method: 'PUT', cookie: adminCookie, body: { revision: 1, name: 'Changed' } })).status).toBe(200);
    expect(await drain(target)).toEqual(['users.changed']);
    expect(await drain(viewer)).toEqual(['users.changed']);

    expect((await jsonRequest(app, `/api/users/${targetId}/editing`, { method: 'DELETE', cookie: adminCookie })).status).toBe(200);
    expect(await drain(viewer)).toEqual(['users.editing']);
    expect(await jsonRequest(app, '/api/users/editing', { cookie: viewerCookie })).toMatchObject({ payload: { data: { editing: {} } } });

    expect((await jsonRequest(app, '/api/users', { method: 'DELETE', cookie: adminCookie, body: { ids: [targetId] } })).status).toBe(200);
    expect(await drain(viewer)).toEqual(['users.changed']);
    expect(await drain(bystander)).toEqual([]);

    // Presence needs users.edit to announce and users.view to read.
    expect((await jsonRequest(app, `/api/users/${adminId}/editing`, { method: 'PUT', cookie: viewerCookie })).status).toBe(403);
    expect((await jsonRequest(app, '/api/users/editing', { cookie: bystanderCookie })).status).toBe(403);
  });
});

describeUsersHost('an unrelated provider', () => {
  const { host, state } = createMockHost();
  return {
    host,
    signIn: async (email, password) => {
      const account = [...state.accounts.values()].find((candidate) => candidate.email === email);
      if (!account || account.passwordHash !== mockHash(password)) throw new Error('Sign-in refused');
      return loginAs(state, account.id);
    },
    grantPermission: (userId, permission) => {
      state.permissions.set(userId, new Set([...(state.permissions.get(userId) ?? []), permission]));
    },
  };
});
