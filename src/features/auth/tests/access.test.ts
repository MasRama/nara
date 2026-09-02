import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { app } from '../../../app/server';
import { getDatabase } from '../../../shared/database';

async function registerAdmin(): Promise<string> {
  const response = await app.request('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Access Administrator',
      email: `${randomUUID()}@example.com`,
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

describe('auth access capability', () => {
  it('lists and creates roles behind the public auth boundary', async () => {
    const cookie = await registerAdmin();
    const roleName = `Billing ${randomUUID()}`;

    const createResponse = await app.request('/api/roles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ name: roleName, slug: `billing-${randomUUID()}`, permissions: [] }),
    });
    expect(createResponse.status).toBe(201);
    await expect(createResponse.json()).resolves.toMatchObject({
      success: true,
      data: { role: { name: roleName, permissions: [] } },
    });

    const listResponse = await app.request('/api/roles', { headers: { Cookie: cookie } });
    expect(listResponse.status).toBe(200);
    await expect(listResponse.json()).resolves.toMatchObject({ success: true });
  });

  it('denies role access without a session', async () => {
    const response = await app.request('/api/roles');
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({ code: 'UNAUTHORIZED' });
  });
});
