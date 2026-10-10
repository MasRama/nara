import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { app, resetSecurityState } from './server';
import { TEMPORARY_PASSWORD_PATHS } from '../features/auth';
import { getDatabase } from '../shared/database';
import { closeEventStreams } from '../shared/realtime';
import { apiRoutes, type ApiRoute } from '../shared/security';
import { csrfHeaders, issueCsrf, mergeResponseCookies } from '../shared/security/tests/helpers';

/**
 * Who may reach which API endpoint, derived from the routes the application
 * actually mounts and the access their guards declare, so a Feature's new
 * route is covered without editing this file.
 *
 * "Allowed" means authorization let the request through: the handler may still
 * answer 2xx, 404, 409, or 422, but never 401 or 403. Requests use empty
 * bodies and unknown targets so they cannot change the personas.
 */
const UNKNOWN_ID = 'f2a1c7de-0000-4000-8000-000000000000';

/**
 * Which permission admits each restricted route. Features leave the rule to
 * their host, so the slug is the application's binding policy and is pinned
 * here; a restricted route missing from this table fails the run.
 */
const PERMISSION_FOR: Record<string, string> = {
  'GET /api/roles': 'roles.view',
  'GET /api/roles/permissions': 'roles.view',
  'GET /api/roles/editing': 'roles.view',
  'PUT /api/roles/:id/editing': 'roles.edit',
  'DELETE /api/roles/:id/editing': 'roles.edit',
  'POST /api/roles': 'roles.create',
  'PUT /api/roles/:id': 'roles.edit',
  'DELETE /api/roles': 'roles.delete',
  'GET /api/users/editing': 'users.view',
  'PUT /api/users/:id/editing': 'users.edit',
  'DELETE /api/users/:id/editing': 'users.edit',
  'GET /api/users': 'users.view',
  'POST /api/users': 'users.create',
  'PUT /api/users/:id': 'users.edit',
  'POST /api/users/:id/reset-password': 'users.reset-password',
  'DELETE /api/users': 'users.delete',
  'GET /api/activity': 'activity.view',
};

const AUTH_MOUNT = '/api/auth';
const temporaryPasswordPaths = new Set(TEMPORARY_PASSWORD_PATHS.map((path) => `${AUTH_MOUNT}${path}`));

const routes = apiRoutes(app);
const label = (route: ApiRoute) => `${route.method} ${route.path}`;
const target = (route: ApiRoute) => route.path.replace(/:[^/]+/g, UNKNOWN_ID);

interface Persona {
  id: string;
  cookie: string;
}

async function register(name: string): Promise<Persona> {
  const bootstrap = await issueCsrf(app);
  const response = await app.request('/api/auth/register', {
    method: 'POST',
    headers: { ...csrfHeaders(bootstrap), 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email: `${randomUUID()}@example.com`, password: 'correct horse battery staple' }),
  });
  if (response.status !== 201) throw new Error(`Registration failed with ${response.status}`);
  const payload = (await response.json()) as { data: { user: { id: string } } };
  return { id: payload.data.user.id, cookie: mergeResponseCookies(bootstrap.cookie, response) };
}

function assignRole(userId: string, slug: string, permissionSlugs: string[]): void {
  const database = getDatabase();
  const now = Date.now();
  const existing = database.prepare('SELECT id FROM roles WHERE slug = ?').get(slug) as { id: string } | undefined;
  const roleId = existing?.id ?? randomUUID();
  if (!existing) {
    database
      .prepare('INSERT INTO roles (id, name, slug, description, created_at, updated_at) VALUES (?, ?, ?, NULL, ?, ?)')
      .run(roleId, slug, slug, now, now);
  }
  for (const permissionSlug of permissionSlugs) {
    const [resource, action] = permissionSlug.split('.', 2);
    database
      .prepare(
        `INSERT OR IGNORE INTO permissions (id, name, slug, resource, action, description, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, NULL, ?, ?)`,
      )
      .run(randomUUID(), permissionSlug, permissionSlug, resource, action, now, now);
    const permissionId = (
      database.prepare('SELECT id FROM permissions WHERE slug = ?').get(permissionSlug) as { id: string }
    ).id;
    database
      .prepare('INSERT OR IGNORE INTO role_permissions (id, role_id, permission_id, created_at) VALUES (?, ?, ?, ?)')
      .run(randomUUID(), roleId, permissionId, now);
  }
  database
    .prepare('INSERT OR IGNORE INTO user_roles (id, user_id, role_id, created_at) VALUES (?, ?, ?, ?)')
    .run(randomUUID(), userId, roleId, now);
}

async function call(route: ApiRoute, persona?: Persona): Promise<{ status: number; code?: string }> {
  const headers: Record<string, string> = {};
  let body: string | undefined;
  if (route.method === 'GET') {
    if (persona) headers.Cookie = persona.cookie;
  } else {
    Object.assign(headers, csrfHeaders(await issueCsrf(app, persona?.cookie)), { 'Content-Type': 'application/json' });
    body = '{}';
  }
  const response = await app.request(target(route), { method: route.method, headers, body });
  if (!response.headers.get('Content-Type')?.includes('application/json')) {
    // An admitted live-update stream stays open; the status is the answer.
    await response.body?.cancel();
    return { status: response.status };
  }
  const payload = (await response.json().catch(() => ({}))) as { code?: string };
  return { status: response.status, code: payload.code };
}

function expectAllowed(result: { status: number; code?: string }): void {
  expect(result.status, `unexpected ${result.code ?? 'response'}`).not.toBe(401);
  expect(result.status, `unexpected ${result.code ?? 'response'}`).not.toBe(403);
  expect(result.status).toBeLessThan(500);
}

describe('API authorization matrix', () => {
  let member: Persona;
  let admin: Persona;
  let temporary: Persona;

  beforeAll(async () => {
    member = await register('Matrix Member');
    admin = await register('Matrix Admin');
    assignRole(admin.id, 'admin', []);
    temporary = await register('Matrix Temporary');
    assignRole(temporary.id, 'admin', []);
    getDatabase().prepare('UPDATE users SET must_change_password = 1 WHERE id = ?').run(temporary.id);
  });

  // Public routes share the strict per-client limit; each case starts afresh.
  beforeEach(() => resetSecurityState());
  afterAll(() => closeEventStreams());

  it('covers every mounted API route, each declaring its access', () => {
    expect(routes.length).toBeGreaterThan(0);
    expect(routes.filter((route) => !route.access).map(label)).toEqual([]);
  });

  it('names the permission for exactly the restricted routes', () => {
    const restricted = routes.filter((route) => route.access === 'restricted').map(label).sort();
    expect(Object.keys(PERMISSION_FOR).sort()).toEqual(restricted);
  });

  for (const route of routes) {
    if (route.access === 'public') {
      // No sign-in is asked for; the handler may still refuse its input (an
      // avatar filename it does not recognise answers 403).
      it(`${label(route)} admits anonymous callers`, async () => {
        const result = await call(route);
        expect(result.status, `unexpected ${result.code ?? 'response'}`).not.toBe(401);
        expect(result.status).toBeLessThan(500);
      });
      continue;
    }

    it(`${label(route)} rejects anonymous callers with 401`, async () => {
      expect(await call(route)).toEqual({ status: 401, code: 'UNAUTHORIZED' });
    });

    if (route.access === 'signed-in') {
      it(`${label(route)} admits any signed-in account`, async () => {
        expectAllowed(await call(route, member));
      });
    } else {
      const slug = PERMISSION_FOR[label(route)];
      it(`${label(route)} requires ${slug ?? 'a declared permission'}`, async () => {
        expect(slug, 'name the permission in PERMISSION_FOR').toBeDefined();
        expect(await call(route, member)).toEqual({ status: 403, code: 'FORBIDDEN' });

        const granted = await register(`Matrix ${slug}`);
        assignRole(granted.id, `matrix-${randomUUID()}`, [slug]);
        expectAllowed(await call(route, granted));
      });
    }

    it(`${label(route)} admits administrators`, async () => {
      expectAllowed(await call(route, admin));
    });

    if (temporaryPasswordPaths.has(route.path)) {
      it(`${label(route)} stays reachable with a temporary password`, async () => {
        expectAllowed(await call(route, temporary));
      });
    } else {
      it(`${label(route)} is blocked until a temporary password is replaced`, async () => {
        expect(await call(route, temporary)).toEqual({ status: 403, code: 'PASSWORD_CHANGE_REQUIRED' });
      });
    }
  }
});
