import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { app } from '../../../app/server';

describe('auth feature', () => {
  it('registers, authenticates, and ends a session end-to-end', async () => {
    const email = `${randomUUID()}@example.com`;
    const request = {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    } as const;

    const registerResponse = await app.request('/api/auth/register', {
      ...request,
      body: JSON.stringify({ name: 'Ada Lovelace', email, password: 'correct horse battery staple' }),
    });

    expect(registerResponse.status).toBe(201);
    const registration = await registerResponse.json() as {
      success: boolean;
      data: { user: { email: string } };
    };
    expect(registration.success).toBe(true);
    expect(registration.data.user.email).toBe(email);

    const sessionCookie = registerResponse.headers.get('set-cookie')?.split(';', 1)[0];
    expect(sessionCookie).toMatch(/^auth_id=.+/);

    const meResponse = await app.request('/api/auth/me', {
      headers: { Cookie: sessionCookie! },
    });
    expect(meResponse.status).toBe(200);
    await expect(meResponse.json()).resolves.toMatchObject({
      success: true,
      data: { user: { email, name: 'Ada Lovelace' } },
    });

    const logoutResponse = await app.request('/api/auth/logout', {
      ...request,
      headers: { ...request.headers, Cookie: sessionCookie! },
    });
    expect(logoutResponse.status).toBe(200);

    const afterLogoutResponse = await app.request('/api/auth/me', {
      headers: { Cookie: sessionCookie! },
    });
    expect(afterLogoutResponse.status).toBe(401);
  });

  it('rejects malformed registration input with field diagnostics', async () => {
    const response = await app.request('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
