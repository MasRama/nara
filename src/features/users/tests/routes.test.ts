import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { app } from '../../../app/server';
import { csrfHeaders, issueCsrf, mergeResponseCookies } from '../../../shared/security/tests/helpers';

async function registerUser(email: string): Promise<string> {
  const bootstrap = await issueCsrf(app);
  const response = await app.request('/api/auth/register', {
    method: 'POST',
    headers: { ...csrfHeaders(bootstrap), 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Grace Hopper', email, password: 'correct horse battery staple' }),
  });
  const cookie = mergeResponseCookies(bootstrap.cookie, response);
  if (!cookie.includes('auth_id=')) throw new Error('Registration did not return a session cookie');
  return cookie;
}

async function patchProfile(cookie: string, body: unknown) {
  const state = await issueCsrf(app, cookie);
  return app.request('/api/users/me', {
    method: 'PATCH',
    headers: { ...csrfHeaders(state), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('users feature', () => {
  it('uses auth public exports to read and update the current profile', async () => {
    const email = `${randomUUID()}@example.com`;
    const cookie = await registerUser(email);

    const profileResponse = await app.request('/api/users/me', {
      headers: { Cookie: cookie },
    });
    expect(profileResponse.status).toBe(200);
    await expect(profileResponse.json()).resolves.toMatchObject({
      success: true,
      data: { user: { email, name: 'Grace Hopper' } },
    });

    const updatedEmail = `${randomUUID()}@example.com`;
    const updateResponse = await patchProfile(cookie, { revision: 1, name: 'Grace Brewster Hopper', email: updatedEmail });
    expect(updateResponse.status).toBe(200);
    await expect(updateResponse.json()).resolves.toMatchObject({
      success: true,
      data: { user: { email: updatedEmail, name: 'Grace Brewster Hopper' } },
    });
  });

  it('rejects an invalid email without mutating the current profile', async () => {
    const email = `${randomUUID()}@example.com`;
    const cookie = await registerUser(email);

    const updateResponse = await patchProfile(cookie, { revision: 1, name: 'Grace Brewster Hopper', email: 'not-an-email' });
    expect(updateResponse.status).toBe(422);
    await expect(updateResponse.json()).resolves.toMatchObject({
      success: false,
      message: 'Validation failed',
      code: 'VALIDATION_ERROR',
      errors: { email: ['Invalid email format'] },
    });

    const profileResponse = await app.request('/api/users/me', {
      headers: { Cookie: cookie },
    });
    expect(profileResponse.status).toBe(200);
    await expect(profileResponse.json()).resolves.toMatchObject({
      success: true,
      data: { user: { email, name: 'Grace Hopper' } },
    });
  });

  it('requires an authenticated session', async () => {
    const response = await app.request('/api/users/me');

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      code: 'UNAUTHORIZED',
    });
  });

  it('refuses to edit another account before validating the body', async () => {
    const editor = await registerUser(`${randomUUID()}@example.com`);
    const target = await registerUser(`${randomUUID()}@example.com`);
    const targetProfile = (await (await app.request('/api/users/me', { headers: { Cookie: target } })).json()) as {
      data: { user: { id: string } };
    };

    const put = async (cookie: string, userId: string) => {
      const state = await issueCsrf(app, cookie);
      return app.request(`/api/users/${userId}`, {
        method: 'PUT',
        headers: { ...csrfHeaders(state), 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'not-an-email' }),
      });
    };

    const other = await put(editor, targetProfile.data.user.id);
    expect(other.status).toBe(403);
    expect(await other.json()).toEqual({ success: false, message: 'Forbidden', code: 'FORBIDDEN' });

    const self = await put(target, targetProfile.data.user.id);
    expect(self.status).toBe(422);
    await expect(self.json()).resolves.toMatchObject({ code: 'VALIDATION_ERROR', errors: { email: ['Invalid email format'] } });
  });
});
