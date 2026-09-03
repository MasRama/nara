import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { app } from '../../../app/server';
import { csrfHeaders, issueCsrf, mergeResponseCookies } from '../../../shared/security/tests/helpers';

function sessionId(cookieJar: string): string {
  const match = cookieJar
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith('auth_id='));
  if (!match) throw new Error('Session cookie missing from jar');
  return match;
}

describe('auth feature', () => {
  it('registers, authenticates, and ends a session end-to-end', async () => {
    const email = `${randomUUID()}@example.com`;
    const bootstrap = await issueCsrf(app);
    const json = { 'Content-Type': 'application/json' };

    const registerResponse = await app.request('/api/auth/register', {
      method: 'POST',
      headers: { ...csrfHeaders(bootstrap), ...json },
      body: JSON.stringify({ name: 'Ada Lovelace', email, password: 'correct horse battery staple' }),
    });

    expect(registerResponse.status).toBe(201);
    const registration = await registerResponse.json() as {
      success: boolean;
      data: { user: { email: string } };
    };
    expect(registration.success).toBe(true);
    expect(registration.data.user.email).toBe(email);

    const sessionCookie = mergeResponseCookies(bootstrap.cookie, registerResponse);
    expect(sessionId(sessionCookie)).toMatch(/^auth_id=.+/);

    const meResponse = await app.request('/api/auth/me', {
      headers: { Cookie: sessionCookie },
    });
    expect(meResponse.status).toBe(200);
    await expect(meResponse.json()).resolves.toMatchObject({
      success: true,
      data: { user: { email, name: 'Ada Lovelace' } },
    });

    const logoutState = await issueCsrf(app, sessionCookie);
    const logoutResponse = await app.request('/api/auth/logout', {
      method: 'POST',
      headers: csrfHeaders(logoutState),
    });
    expect(logoutResponse.status).toBe(200);

    const afterLogoutResponse = await app.request('/api/auth/me', {
      headers: { Cookie: sessionCookie },
    });
    expect(afterLogoutResponse.status).toBe(401);
  });

  it('rejects malformed registration input with field diagnostics', async () => {
    const bootstrap = await issueCsrf(app);
    const response = await app.request('/api/auth/register', {
      method: 'POST',
      headers: { ...csrfHeaders(bootstrap), 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'A', email: 'invalid', password: 'short' }),
    });

    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      code: 'VALIDATION_ERROR',
      errors: {
        name: expect.any(Array),
        email: expect.any(Array),
        password: expect.any(Array),
      },
    });
  });
});
