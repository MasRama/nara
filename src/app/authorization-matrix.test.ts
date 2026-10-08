import { randomUUID } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import { app } from './server';
import { getDatabase } from '../shared/database';
import { csrfHeaders, issueCsrf, mergeResponseCookies } from '../shared/security/tests/helpers';

/**
 * Who may reach which API endpoint, pinned per endpoint and persona.
 *
 * "Allowed" means authorization let the request through: the handler may still
 * answer 2xx, 404, 409, or 422, but never 401 or 403. Requests in the allowed
 * column use empty or unknown targets so they cannot change the personas.
 */
type Access = { kind: 'session' } | { kind: 'permission'; slug: string };

interface Endpoint {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;
  access: Access;
  /** Reachable while the account still has to replace a temporary password. */
  temporaryPasswordAllowed?: boolean;
}

const session: Access = { kind: 'session' };
const permission = (slug: string): Access => ({ kind: 'permission', slug });
const UNKNOWN_ID = 'f2a1c7de-0000-4000-8000-000000000000';

const ENDPOINTS: Endpoint[] = [
  { method: 'GET', path: '/api/auth/me', access: session, temporaryPasswordAllowed: true },
  { method: 'POST', path: '/api/auth/change-password', access: session, temporaryPasswordAllowed: true },
  { method: 'GET', path: '/api/auth/sessions', access: session },
  { method: 'POST', path: '/api/auth/sessions/revoke-others', access: session },
  { method: 'DELETE', path: `/api/auth/sessions/${UNKNOWN_ID}`, access: session },
  { method: 'GET', path: '/api/auth/two-factor', access: session },
  { method: 'POST', path: '/api/auth/two-factor/setup', access: session },
  { method: 'POST', path: '/api/auth/two-factor/enable', access: session },
  { method: 'POST', path: '/api/auth/two-factor/disable', access: session },
  { method: 'POST', path: '/api/auth/two-factor/recovery-codes', access: session },
  { method: 'GET', path: '/api/roles', access: permission('roles.view') },
  { method: 'GET', path: '/api/roles/permissions', access: permission('roles.view') },
  { method: 'POST', path: '/api/roles', access: permission('roles.create') },
  { method: 'PUT', path: `/api/roles/${UNKNOWN_ID}`, access: permission('roles.edit') },
  { method: 'DELETE', path: '/api/roles', access: permission('roles.delete') },
  { method: 'GET', path: '/api/users/me', access: session },
  { method: 'PATCH', path: '/api/users/me', access: session },
  { method: 'GET', path: '/api/users', access: permission('users.view') },
  { method: 'POST', path: '/api/users', access: permission('users.create') },
  { method: 'PUT', path: `/api/users/${UNKNOWN_ID}`, access: permission('users.edit') },
  { method: 'POST', path: `/api/users/${UNKNOWN_ID}/reset-password`, access: permission('users.reset-password') },
  { method: 'DELETE', path: '/api/users', access: permission('users.delete') },
  { method: 'POST', path: '/api/assets/avatar', access: session },
  { method: 'GET', path: '/api/activity', access: permission('activity.view') },
];

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

async function call(endpoint: Endpoint, persona?: Persona): Promise<{ status: number; code?: string }> {
  const headers: Record<string, string> = {};
  let body: string | undefined;
  if (endpoint.method === 'GET') {
    if (persona) headers.Cookie = persona.cookie;
  } else {
    Object.assign(headers, csrfHeaders(await issueCsrf(app, persona?.cookie)), { 'Content-Type': 'application/json' });
    body = '{}';
  }
  const response = await app.request(endpoint.path, { method: endpoint.method, headers, body });
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

  for (const endpoint of ENDPOINTS) {
    const label = `${endpoint.method} ${endpoint.path.replace(UNKNOWN_ID, ':id')}`;

    it(`${label} rejects anonymous callers with 401`, async () => {
      expect(await call(endpoint)).toEqual({ status: 401, code: 'UNAUTHORIZED' });
    });

    if (endpoint.access.kind === 'session') {
      it(`${label} admits any signed-in account`, async () => {
        expectAllowed(await call(endpoint, member));
      });
    } else {
      const slug = endpoint.access.slug;
      it(`${label} requires ${slug}`, async () => {
        expect(await call(endpoint, member)).toEqual({ status: 403, code: 'FORBIDDEN' });

        const granted = await register(`Matrix ${slug}`);
        assignRole(granted.id, `matrix-${randomUUID()}`, [slug]);
        expectAllowed(await call(endpoint, granted));
      });
    }

    it(`${label} admits administrators`, async () => {
      expectAllowed(await call(endpoint, admin));
    });

    if (endpoint.temporaryPasswordAllowed) {
      it(`${label} stays reachable with a temporary password`, async () => {
        expectAllowed(await call(endpoint, temporary));
      });
    } else {
      it(`${label} is blocked until a temporary password is replaced`, async () => {
        expect(await call(endpoint, temporary)).toEqual({ status: 403, code: 'PASSWORD_CHANGE_REQUIRED' });
      });
    }
  }
});
