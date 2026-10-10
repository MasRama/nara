import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { app } from '../../../app/server';
import { grantPermissions } from '../../../app/tests/personas';
import { installBrowser, type TestBrowser } from '../../../shared/security/tests/browser';
import { activityResponseSchemas } from '../contract';
import { createActivityClient } from '../web';

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
    grantPermissions((await browser.signUp()).id, ['activity.view']);
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

    grantPermissions(userId, ['activity.view']);
    expect(activityErrorSchema.parse(await client.list({ limit: 1000 }))).toMatchObject({
      code: 'VALIDATION_ERROR',
      errors: { limit: expect.any(Array) },
    });
  });
});
