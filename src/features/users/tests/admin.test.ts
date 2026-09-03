import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { app } from '../../../app/server';
import { getDatabase } from '../../../shared/database';

async function registerAdmin(email = `${randomUUID()}@example.com`, name = 'User Administrator'): Promise<string> {
  const response = await app.request('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name,
      email,
      password: 'correct horse battery staple',
    }),
  });
  const cookie = response.headers.get('set-cookie')?.split(';', 1)[0];
  if (!cookie) throw new Error('Registration did not return a session cookie');
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

describe('users administration capability', () => {
  it('creates and lists users through the users Feature', async () => {
    const cookie = await registerAdmin();
    const email = `${randomUUID()}@example.com`;

    const createResponse = await app.request('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ name: 'Managed User', email, password: 'managed-password' }),
    });
    expect(createResponse.status).toBe(201);
    await expect(createResponse.json()).resolves.toMatchObject({
      success: true,
      data: { user: { name: 'Managed User', email, roles: [] } },
    });

    const listResponse = await app.request('/api/users?search=Managed%20User', { headers: { Cookie: cookie } });
    expect(listResponse.status).toBe(200);
    await expect(listResponse.json()).resolves.toMatchObject({
      success: true,
      data: { total: 1, users: [{ email, name: 'Managed User' }] },
    });
  });

  it('rejects self-demotion before mutating the profile, password, or roles', async () => {
    const email = `${randomUUID()}@example.com`;
    const cookie = await registerAdmin(email, 'Original Administrator');
    const database = getDatabase();
    const before = database
      .prepare('SELECT id, name, email, password FROM users WHERE email = ?')
      .get(email) as { id: string; name: string; email: string; password: string };
    const rolesBefore = database
      .prepare('SELECT role_id FROM user_roles WHERE user_id = ? ORDER BY role_id')
      .all(before.id);

    const response = await app.request(`/api/users/${before.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({
        name: 'Rejected Administrator',
        email: `${randomUUID()}@example.com`,
        password: 'rejected new password',
        roles: [],
      }),
    });
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      message: 'Cannot remove admin role from yourself',
      code: 'SELF_DEMOTION',
    });

    const after = database
      .prepare('SELECT id, name, email, password FROM users WHERE id = ?')
      .get(before.id);
    const rolesAfter = database
      .prepare('SELECT role_id FROM user_roles WHERE user_id = ? ORDER BY role_id')
      .all(before.id);
    expect(after).toEqual(before);
    expect(rolesAfter).toEqual(rolesBefore);
  });

  it('requires a password when creating a managed user', async () => {
    const cookie = await registerAdmin();
    const email = `${randomUUID()}@example.com`;

    const response = await app.request('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ name: 'Missing Password', email }),
    });
    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      code: 'VALIDATION_ERROR',
      errors: { password: expect.any(Array) },
    });
    expect(databaseUser(email)).toBeUndefined();
  });

  it('keeps a managed user password when editing without a password', async () => {
    const cookie = await registerAdmin();
    const email = `${randomUUID()}@example.com`;
    const createResponse = await app.request('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ name: 'Password Owner', email, password: 'original managed password' }),
    });
    expect(createResponse.status).toBe(201);
    const created = (await createResponse.json()) as { data: { user: { id: string } } };
    const database = getDatabase();
    const before = database.prepare('SELECT password FROM users WHERE id = ?').get(created.data.user.id) as { password: string };

    const updateResponse = await app.request(`/api/users/${created.data.user.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ name: 'Updated Password Owner', email }),
    });
    expect(updateResponse.status).toBe(200);
    const after = database.prepare('SELECT password FROM users WHERE id = ?').get(created.data.user.id) as { password: string };
    expect(after.password).toBe(before.password);
  });
});

function databaseUser(email: string): unknown {
  return getDatabase().prepare('SELECT id FROM users WHERE email = ?').get(email);
}
