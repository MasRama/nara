// @vitest-environment node
import { randomUUID } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import { getDatabase } from '../../../shared/database';
import { createAssetRoutes, createUserRoutes, type UsersServerHost } from '../index';

const ONE_PIXEL_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
);

/**
 * Isolated alternative provider: a small in-memory identity and
 * authorization implementation with its own vocabulary. It shares no code
 * with the Auth Feature; if Users reaches past this host, these tests fail.
 */
interface MockHostState {
  actors: Map<string, string>;
  admins: Set<string>;
  permissions: Map<string, Set<string>>;
  roles: Array<{ id: string; slug: string }>;
  assignments: Map<string, string[]>;
}

function createMockHost(cookieName = 'mock_session'): { host: UsersServerHost; state: MockHostState } {
  const state: MockHostState = {
    actors: new Map(),
    admins: new Set(),
    permissions: new Map(),
    roles: [
      { id: 'mock-role-admin', slug: 'admin' },
      { id: 'mock-role-user', slug: 'user' },
    ],
    assignments: new Map(),
  };
  const host: UsersServerHost = {
    sessionCookieName: cookieName,
    resolveActor: (sessionToken) => {
      const id = sessionToken ? state.actors.get(sessionToken) : undefined;
      return id ? { id, avatar: null } : undefined;
    },
    hashPassword: (password) => `mock-hash:${password}`,
    canManageUsers: (actorId, action) =>
      state.admins.has(actorId) || (state.permissions.get(actorId)?.has(`users.${action}`) ?? false),
    canAssignRoles: (actorId) => state.admins.has(actorId),
    availableRoles: () => state.roles.map((role) => ({ ...role })),
    rolesForUser: (userId) =>
      (state.assignments.get(userId) ?? []).map((id) => state.roles.find((role) => role.id === id)?.slug ?? id),
    setUserRoles: (userId, roleIds) => {
      state.assignments.set(userId, [...roleIds]);
    },
    usersWithRole: (roleId) =>
      [...state.assignments.entries()].filter(([, ids]) => ids.includes(roleId)).map(([id]) => ({ id })),
  };
  return { host, state };
}

function seedUser(email = `${randomUUID()}@example.com`): { id: string; email: string } {
  const id = randomUUID();
  const now = Date.now();
  getDatabase()
    .prepare(
      'INSERT INTO users (id, name, email, password, avatar, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    )
    .run(id, 'Mock User', email, `mock-hash:${randomUUID()}`, null, now, now);
  return { id, email };
}

function loginAs(state: MockHostState, userId: string, options: { admin?: boolean; permissions?: string[] } = {}): string {
  const token = randomUUID();
  state.actors.set(token, userId);
  if (options.admin) state.admins.add(userId);
  if (options.permissions) state.permissions.set(userId, new Set(options.permissions));
  return `${token}`;
}

function buildApp(host: UsersServerHost): Hono {
  return new Hono().route('/api/users', createUserRoutes(host)).route('/api/assets', createAssetRoutes(host));
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

describe('users host requirements with an alternative provider', () => {
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
    const { id } = seedUser();
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
    const { id } = seedUser();
    const cookie = cookieFor(host, loginAs(state, id, { permissions: ['users.view'] }));

    const listed = await jsonRequest(app, '/api/users', { cookie });
    expect(listed.status).toBe(200);

    const deleted = await jsonRequest(app, '/api/users', { method: 'DELETE', cookie, body: { ids: [randomUUID()] } });
    expect(deleted.status).toBe(403);
  });

  it('creates users through host password hashing and role assignment', async () => {
    const { host, state } = createMockHost();
    const app = buildApp(host);
    const { id: adminId } = seedUser();
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

    const stored = getDatabase().prepare('SELECT password FROM users WHERE id = ?').get(userId) as {
      password: string;
    };
    expect(stored.password).toBe('mock-hash:correct horse battery staple');
    expect(state.assignments.get(userId)).toEqual(['mock-role-user']);

    const listed = await jsonRequest(app, '/api/users', { cookie });
    expect(listed.status).toBe(200);
    expect(listed.payload).toMatchObject({
      data: { users: expect.arrayContaining([expect.objectContaining({ id: userId, roles: ['user'] })]) },
    });
  });

  it('refuses role assignment without host trust and keeps passwords stable on edit', async () => {
    const { host, state } = createMockHost();
    const app = buildApp(host);
    const { id: managerId } = seedUser();
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

    const { id: targetId } = seedUser();
    const before = getDatabase().prepare('SELECT password FROM users WHERE id = ?').get(targetId) as {
      password: string;
    };
    const updated = await jsonRequest(app, `/api/users/${targetId}`, {
      method: 'PUT',
      cookie,
      body: { name: 'Renamed User' },
    });
    expect(updated.status).toBe(200);
    const after = getDatabase().prepare('SELECT password FROM users WHERE id = ?').get(targetId) as {
      password: string;
    };
    expect(after.password).toBe(before.password);
  });

  it('protects the last admin and self-demotion through host role state', async () => {
    const { host, state } = createMockHost();
    const app = buildApp(host);
    const { id: adminId } = seedUser();
    state.assignments.set(adminId, ['mock-role-admin']);
    const cookie = cookieFor(host, loginAs(state, adminId, { admin: true }));

    const demotion = await jsonRequest(app, `/api/users/${adminId}`, {
      method: 'PUT',
      cookie,
      body: { roles: ['user'] },
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

    const { id: otherId } = seedUser();
    const onlyAdmin = await jsonRequest(app, '/api/users', { method: 'DELETE', cookie, body: { ids: [otherId] } });
    expect(onlyAdmin.status).toBe(200);
  });

  it('honors a binding-chosen session cookie name', async () => {
    const { host, state } = createMockHost('custom_session');
    const app = buildApp(host);
    const { id } = seedUser();
    const token = loginAs(state, id);

    const wrongCookie = await jsonRequest(app, '/api/users/me', { cookie: `mock_session=${token}` });
    expect(wrongCookie.status).toBe(401);

    const rightCookie = await jsonRequest(app, '/api/users/me', { cookie: cookieFor(host, token) });
    expect(rightCookie.status).toBe(200);
  });

  it('serves the avatar surface through the same host', async () => {
    const { host, state } = createMockHost();
    const app = buildApp(host);
    const { id } = seedUser();
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

    const filename = payload.data.url.split('/').pop();
    if (filename) await rm(resolve(process.cwd(), 'storage', 'avatars', filename), { force: true });
    const assets = getDatabase().prepare('SELECT * FROM assets WHERE url = ?').all(payload.data.url);
    for (const asset of assets as Array<{ id: string }>) {
      getDatabase().prepare('DELETE FROM assets WHERE id = ?').run(asset.id);
    }
    getDatabase().prepare('UPDATE users SET avatar = NULL WHERE id = ?').run(id);
  });

  it('rejects invalid input through host-authorized actors without touching providers', async () => {
    const { host, state } = createMockHost();
    const app = buildApp(host);
    const { id: adminId } = seedUser();
    const cookie = cookieFor(host, loginAs(state, adminId, { admin: true }));

    const created = await jsonRequest(app, '/api/users', {
      method: 'POST',
      cookie,
      body: { name: '', email: 'not-an-email' },
    });
    expect(created.status).toBe(422);
    expect(created.payload).toMatchObject({ success: false, code: 'VALIDATION_ERROR' });
  });
});
