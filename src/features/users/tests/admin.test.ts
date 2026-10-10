import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { app } from '../../../app/server';
import { getDatabase } from '../../../shared/database';
import { csrfHeaders, issueCsrf } from '../../../shared/security/tests/helpers';
import { grantAdmin, signUp } from '../../../app/tests/personas';

async function registerAdmin(email?: string, name = 'User Administrator'): Promise<string> {
  const admin = await signUp(name, email);
  grantAdmin(admin.id);
  return admin.cookie;
}

async function mutate(cookie: string, path: string, method: string, body: unknown) {
  const state = await issueCsrf(app, cookie);
  return app.request(path, {
    method,
    headers: { ...csrfHeaders(state), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('users administration capability', () => {
  it('creates and lists users through the users Feature', async () => {
    const cookie = await registerAdmin();
    const email = `${randomUUID()}@example.com`;

    const createResponse = await mutate(cookie, '/api/users', 'POST', { name: 'Managed User', email, password: 'managed-password' });
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

    const response = await mutate(cookie, `/api/users/${before.id}`, 'PUT', {
      revision: 1,
      name: 'Rejected Administrator',
      email: `${randomUUID()}@example.com`,
      password: 'rejected new password',
      roles: [],
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

    const response = await mutate(cookie, '/api/users', 'POST', { name: 'Missing Password', email });
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
    const createResponse = await mutate(cookie, '/api/users', 'POST', { name: 'Password Owner', email, password: 'original managed password' });
    expect(createResponse.status).toBe(201);
    const created = (await createResponse.json()) as { data: { user: { id: string } } };
    const database = getDatabase();
    const before = database.prepare('SELECT password FROM users WHERE id = ?').get(created.data.user.id) as { password: string };

    const updateResponse = await mutate(cookie, `/api/users/${created.data.user.id}`, 'PUT', { revision: 1, name: 'Updated Password Owner', email });
    expect(updateResponse.status).toBe(200);
    const after = database.prepare('SELECT password FROM users WHERE id = ?').get(created.data.user.id) as { password: string };
    expect(after.password).toBe(before.password);
  });
});

function databaseUser(email: string): unknown {
  return getDatabase().prepare('SELECT id FROM users WHERE email = ?').get(email);
}
