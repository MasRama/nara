import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { app } from '../../../app/server';
import { getDatabase, seed } from '../../../shared/database';
import { csrfHeaders, issueCsrf, mergeResponseCookies } from '../../../shared/security/tests/helpers';
import { createRoleWithPermissions, getRolePermissions, updateRoleWithPermissions } from '../server/access';

async function registerAdmin(): Promise<string> {
  const bootstrap = await issueCsrf(app);
  const response = await app.request('/api/auth/register', {
    method: 'POST',
    headers: { ...csrfHeaders(bootstrap), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Access Administrator',
      email: `${randomUUID()}@example.com`,
      password: 'correct horse battery staple',
    }),
  });
  const cookie = mergeResponseCookies(bootstrap.cookie, response);
  if (!cookie.includes('auth_id=')) throw new Error('Registration did not return a session cookie');
  const payload = (await response.json()) as { data: { user: { id: string } } };
  const database = getDatabase();
  const existingRole = database.prepare('SELECT id FROM roles WHERE slug = ?').get('admin') as { id: string } | undefined;
  const roleId = existingRole?.id ?? randomUUID();
  if (!existingRole) {
    database
      .prepare(
        `INSERT INTO roles (id, name, slug, description, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(roleId, 'Administrator', 'admin', 'Test administrator', Date.now(), Date.now());
  }
  database.prepare('INSERT OR IGNORE INTO user_roles (id, user_id, role_id, created_at) VALUES (?, ?, ?, ?)').run(
    randomUUID(),
    payload.data.user.id,
    roleId,
    Date.now(),
  );
  return cookie;
}


async function registerUser(): Promise<{ cookie: string; id: string }> {
  const bootstrap = await issueCsrf(app);
  const response = await app.request('/api/auth/register', {
    method: 'POST',
    headers: { ...csrfHeaders(bootstrap), 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Delegated Editor', email: `${randomUUID()}@example.com`, password: 'correct horse battery staple' }),
  });
  const cookie = mergeResponseCookies(bootstrap.cookie, response);
  const payload = (await response.json()) as { data: { user: { id: string } } };
  return { cookie, id: payload.data.user.id };
}

function ensurePermission(slug: string): string {
  const database = getDatabase();
  const existing = database.prepare('SELECT id FROM permissions WHERE slug = ?').get(slug) as { id: string } | undefined;
  if (existing) return existing.id;
  const id = `test-permission-${randomUUID()}`;
  const [resource, action] = slug.split('.', 2);
  database
    .prepare('INSERT INTO permissions (id, name, slug, resource, action, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .run(id, slug, slug, resource, action, null, Date.now(), Date.now());
  return id;
}

describe('auth access capability', () => {
  it('lists and creates roles behind the public auth boundary', async () => {
    const cookie = await registerAdmin();
    const roleName = `Billing ${randomUUID()}`;
    const roleSlug = `billing-${randomUUID()}`;

    const createState = await issueCsrf(app, cookie);
    const createResponse = await app.request('/api/roles', {
      method: 'POST',
      headers: { ...csrfHeaders(createState), 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: roleName, slug: roleSlug, permissions: [] }),
    });
    expect(createResponse.status).toBe(201);
    await expect(createResponse.json()).resolves.toMatchObject({
      success: true,
      data: { role: { name: roleName, permissions: [] } },
    });

    const listResponse = await app.request('/api/roles', { headers: { Cookie: cookie } });
    expect(listResponse.status).toBe(200);
    await expect(listResponse.json()).resolves.toMatchObject({ success: true });

    const duplicateState = await issueCsrf(app, cookie);
    const duplicateResponse = await app.request('/api/roles', {
      method: 'POST',
      headers: { ...csrfHeaders(duplicateState), 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: `${roleName} duplicate`, slug: roleSlug, permissions: [] }),
    });
    expect(duplicateResponse.status).toBe(409);
    await expect(duplicateResponse.json()).resolves.toMatchObject({ success: false, code: 'DUPLICATE_SLUG' });
  });

  it('rejects admin-role edits without changing the canonical role', async () => {
    const cookie = await registerAdmin();
    const database = getDatabase();
    const before = database.prepare('SELECT * FROM roles WHERE slug = ?').get('admin');
    if (!before || typeof before !== 'object' || !('id' in before)) throw new Error('Missing canonical admin role');

    const editState = await issueCsrf(app, cookie);
    const response = await app.request(`/api/roles/${before.id}`, {
      method: 'PUT',
      headers: { ...csrfHeaders(editState), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Renamed Administrator',
        slug: 'renamed-administrator',
        description: 'This mutation must be rejected',
        permissions: [],
      }),
    });
    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      message: 'Cannot edit the admin role',
      code: 'PROTECTED_ROLE',
    });
    expect(database.prepare('SELECT * FROM roles WHERE id = ?').get(before.id)).toEqual(before);
  });

  it('reports duplicate role slugs as conflicts on update', async () => {
    const cookie = await registerAdmin();
    const firstSlug = `first-${randomUUID()}`;
    const secondSlug = `second-${randomUUID()}`;

    async function createRole(name: string, slug: string): Promise<string> {
      const state = await issueCsrf(app, cookie);
      const response = await app.request('/api/roles', {
        method: 'POST',
        headers: { ...csrfHeaders(state), 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, slug, permissions: [] }),
      });
      expect(response.status).toBe(201);
      const payload = await response.json() as { data: { role: { id: string } } };
      return payload.data.role.id;
    }

    await createRole('First Role', firstSlug);
    const secondId = await createRole('Second Role', secondSlug);
    const updateState = await issueCsrf(app, cookie);
    const response = await app.request(`/api/roles/${secondId}`, {
      method: 'PUT',
      headers: { ...csrfHeaders(updateState), 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug: firstSlug }),
    });
    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({ success: false, code: 'DUPLICATE_SLUG' });
  });


  it('rejects unknown permission slugs before creating a role', async () => {
    const cookie = await registerAdmin();
    const slug = `unknown-${randomUUID()}`;
    const state = await issueCsrf(app, cookie);
    const response = await app.request('/api/roles', {
      method: 'POST',
      headers: { ...csrfHeaders(state), 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Unknown Permission Role', slug, permissions: ['does.not-exist'] }),
    });
    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      code: 'VALIDATION_ERROR',
      errors: { permissions: ['Unknown permission: does.not-exist'] },
    });
    expect(getDatabase().prepare('SELECT id FROM roles WHERE slug = ?').get(slug)).toBeUndefined();
  });


  it('rejects unknown permission slugs on update without mutating the role', async () => {
    const cookie = await registerAdmin();
    const id = randomUUID();
    const slug = `known-${randomUUID()}`;
    getDatabase()
      .prepare('INSERT INTO roles (id, name, slug, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
      .run(id, 'Known Role', slug, null, Date.now(), Date.now());
    const before = getDatabase().prepare('SELECT * FROM roles WHERE id = ?').get(id);
    const state = await issueCsrf(app, cookie);
    const response = await app.request(`/api/roles/${id}`, {
      method: 'PUT',
      headers: { ...csrfHeaders(state), 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Must Not Apply', permissions: ['missing.permission'] }),
    });
    expect(response.status).toBe(422);
    expect(getDatabase().prepare('SELECT * FROM roles WHERE id = ?').get(id)).toEqual(before);
  });

  it('prevents delegated roles.edit from granting itself new permissions', async () => {
    const { cookie, id: userId } = await registerUser();
    const database = getDatabase();
    const editPermissionId = ensurePermission('roles.edit');
    ensurePermission('users.delete');
    const roleId = randomUUID();
    const roleSlug = `delegated-${randomUUID()}`;
    database
      .prepare('INSERT INTO roles (id, name, slug, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
      .run(roleId, 'Delegated Role Editor', roleSlug, null, Date.now(), Date.now());
    database
      .prepare('INSERT INTO role_permissions (id, role_id, permission_id, created_at) VALUES (?, ?, ?, ?)')
      .run(randomUUID(), roleId, editPermissionId, Date.now());
    database
      .prepare('INSERT INTO user_roles (id, user_id, role_id, created_at) VALUES (?, ?, ?, ?)')
      .run(randomUUID(), userId, roleId, Date.now());

    const state = await issueCsrf(app, cookie);
    const response = await app.request(`/api/roles/${roleId}`, {
      method: 'PUT',
      headers: { ...csrfHeaders(state), 'Content-Type': 'application/json' },
      body: JSON.stringify({ permissions: ['roles.edit', 'users.delete'] }),
    });
    expect(response.status).toBe(403);
    expect(getRolePermissions(roleId).map((permission) => permission.slug)).toEqual(['roles.edit']);
  });

  it('keeps role creation atomic if permission persistence fails', () => {
    const id = randomUUID();
    const slug = `atomic-${randomUUID()}`;
    expect(() =>
      createRoleWithPermissions(
        { id, name: 'Atomic Role', slug, description: null },
        ['missing-permission-id'],
      ),
    ).toThrow();
    expect(getDatabase().prepare('SELECT id FROM roles WHERE id = ?').get(id)).toBeUndefined();
  });


  it('keeps role metadata and grants atomic on update failure', () => {
    const permissionId = ensurePermission('roles.view');
    const roleId = randomUUID();
    const role = createRoleWithPermissions(
      { id: roleId, name: 'Atomic Update Before', slug: `atomic-update-${randomUUID()}`, description: null },
      [permissionId],
    );
    expect(() => updateRoleWithPermissions(role.id, { name: 'Atomic Update After' }, ['missing-permission-id'])).toThrow();
    expect(getDatabase().prepare('SELECT name FROM roles WHERE id = ?').get(role.id)).toEqual({ name: 'Atomic Update Before' });
    expect(getRolePermissions(role.id).map((permission) => permission.slug)).toEqual(['roles.view']);
  });

  it('seeds least-privilege default access policy', () => {
    seed();
    const database = getDatabase();
    expect(database.prepare("SELECT id FROM permissions WHERE slug IN ('settings.view', 'settings.edit')").all()).toEqual([]);
    expect(database.prepare("SELECT id FROM permissions WHERE slug = 'users.reset-password'").get()).toBeDefined();
    expect(
      database
        .prepare(
          `SELECT 1 FROM role_permissions rp
           JOIN roles r ON r.id = rp.role_id
           JOIN permissions p ON p.id = rp.permission_id
           WHERE r.slug = 'user' AND p.slug = 'users.view'`,
        )
        .get(),
    ).toBeUndefined();
  });

  it('denies role access without a session', async () => {
    const response = await app.request('/api/roles');
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({ code: 'UNAUTHORIZED' });
  });
});
