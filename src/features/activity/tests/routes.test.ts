import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { app } from '../../../app/server';
import { getDatabase } from '../../../shared/database';
import { csrfHeaders, issueCsrf, mergeResponseCookies } from '../../../shared/security/tests/helpers';

async function registerUser(name: string): Promise<{ cookie: string; id: string }> {
  const bootstrap = await issueCsrf(app);
  const response = await app.request('/api/auth/register', {
    method: 'POST',
    headers: { ...csrfHeaders(bootstrap), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name,
      email: `${randomUUID()}@example.com`,
      password: 'correct horse battery staple',
    }),
  });
  expect(response.status).toBe(201);
  const payload = (await response.json()) as { data: { user: { id: string } } };
  return { cookie: mergeResponseCookies(bootstrap.cookie, response), id: payload.data.user.id };
}

function makeAdmin(userId: string): void {
  const database = getDatabase();
  const existing = database.prepare('SELECT id FROM roles WHERE slug = ?').get('admin') as { id: string } | undefined;
  const roleId = existing?.id ?? randomUUID();
  if (!existing) {
    database
      .prepare(
        `INSERT INTO roles (id, name, slug, description, created_at, updated_at)
         VALUES (?, 'Administrator', 'admin', 'Test administrator', ?, ?)`,
      )
      .run(roleId, Date.now(), Date.now());
  }
  database
    .prepare('INSERT OR IGNORE INTO user_roles (id, user_id, role_id, created_at) VALUES (?, ?, ?, ?)')
    .run(randomUUID(), userId, roleId, Date.now());
}

describe('activity capability', () => {
  it('keeps the feed server-authoritative and records Auth/Role events', async () => {
    const anonymous = await app.request('/api/activity');
    expect(anonymous.status).toBe(401);

    const actor = await registerUser('Activity Administrator');
    const forbidden = await app.request('/api/activity', { headers: { Cookie: actor.cookie } });
    expect(forbidden.status).toBe(403);

    makeAdmin(actor.id);
    const registration = await app.request(
      `/api/activity?action=auth.registered&actorId=${encodeURIComponent(actor.id)}`,
      { headers: { Cookie: actor.cookie } },
    );
    expect(registration.status).toBe(200);
    await expect(registration.json()).resolves.toMatchObject({
      success: true,
      data: {
        activities: expect.arrayContaining([
          expect.objectContaining({
            action: 'auth.registered',
            resource: 'auth',
            actorId: actor.id,
            targetId: actor.id,
            targetLabel: 'Activity Administrator',
          }),
        ]),
      },
    });

    const roleName = `Activity Reviewer ${randomUUID().slice(0, 8)}`;
    const roleSlug = `activity-reviewer-${randomUUID()}`;
    const csrf = await issueCsrf(app, actor.cookie);
    const createRole = await app.request('/api/roles', {
      method: 'POST',
      headers: { ...csrfHeaders(csrf), 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: roleName, slug: roleSlug, permissions: [] }),
    });
    expect(createRole.status).toBe(201);

    const roleActivity = await app.request('/api/activity?action=roles.created', {
      headers: { Cookie: actor.cookie },
    });
    expect(roleActivity.status).toBe(200);
    await expect(roleActivity.json()).resolves.toMatchObject({
      success: true,
      data: {
        activities: expect.arrayContaining([
          expect.objectContaining({
            action: 'roles.created',
            actorId: actor.id,
            targetLabel: roleName,
            metadata: { permissionCount: 0 },
          }),
        ]),
      },
    });
  });

  it('records managed user mutations through the application-owned Users binding', async () => {
    const actor = await registerUser('User Activity Administrator');
    makeAdmin(actor.id);

    const targetName = `Managed ${randomUUID().slice(0, 8)}`;
    const csrf = await issueCsrf(app, actor.cookie);
    const createUser = await app.request('/api/users', {
      method: 'POST',
      headers: { ...csrfHeaders(csrf), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: targetName,
        email: `${randomUUID()}@example.com`,
        password: 'correct horse battery staple',
      }),
    });
    expect(createUser.status).toBe(201);
    const created = (await createUser.json()) as { data: { user: { id: string } } };

    const response = await app.request(
      `/api/activity?action=users.created&actorId=${encodeURIComponent(actor.id)}`,
      { headers: { Cookie: actor.cookie } },
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      data: {
        activities: expect.arrayContaining([
          expect.objectContaining({
            action: 'users.created',
            resource: 'users',
            actorId: actor.id,
            targetId: created.data.user.id,
            targetLabel: targetName,
          }),
        ]),
      },
    });
  });
});
