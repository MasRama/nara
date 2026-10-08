import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { app } from '../../../app/server';
import { getDatabase } from '../../../shared/database';
import { installBrowser, type TestBrowser } from '../../../shared/security/tests/browser';
import { activityResponseSchemas } from '../contract';
import { createActivityClient } from '../web';

function grantActivityView(userId: string): void {
  const database = getDatabase();
  const existing = database.prepare("SELECT id FROM roles WHERE slug = 'admin'").get() as { id: string } | undefined;
  const roleId = existing?.id ?? randomUUID();
  if (!existing) {
    database
      .prepare(
        `INSERT INTO roles (id, name, slug, description, created_at, updated_at)
         VALUES (?, 'Administrator', 'admin', NULL, ?, ?)`,
      )
      .run(roleId, Date.now(), Date.now());
  }
  database
    .prepare('INSERT INTO user_roles (id, user_id, role_id, created_at) VALUES (?, ?, ?, ?)')
    .run(randomUUID(), userId, roleId, Date.now());
}

const { error: activityErrorSchema, listSuccess: activityListSuccessSchema } = activityResponseSchemas();

describe('activity web client contract', () => {
  let browser: TestBrowser;
  const client = createActivityClient();

  beforeEach(() => {
    browser = installBrowser(app);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('lists activity in the declared success shape', async () => {
    grantActivityView((await browser.signUp()).id);
    expect(browser.cookieHeader()).toContain('auth_id=');

    const all = activityListSuccessSchema.parse(await client.list());
    expect(all.data.activities.length).toBeGreaterThan(0);

    const filtered = activityListSuccessSchema.parse(
      await client.list({ page: 1, limit: 5, action: 'auth.registered', from: 0, to: Date.now() }),
    );
    expect(filtered.data.limit).toBe(5);
    expect(filtered.data.activities.every((activity) => activity.action === 'auth.registered')).toBe(true);
  });

  it('answers refusals and invalid filters in the declared error shape', async () => {
    expect(activityErrorSchema.parse(await client.list())).toMatchObject({ code: 'UNAUTHORIZED' });

    const { id: userId } = await browser.signUp();
    expect(activityErrorSchema.parse(await client.list())).toMatchObject({ code: 'FORBIDDEN' });

    grantActivityView(userId);
    expect(activityErrorSchema.parse(await client.list({ limit: 1000 }))).toMatchObject({
      code: 'VALIDATION_ERROR',
      errors: { limit: expect.any(Array) },
    });
  });
});
