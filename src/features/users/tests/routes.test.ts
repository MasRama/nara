import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { app } from '../../../app/server';

async function registerUser(email: string): Promise<string> {
  const response = await app.request('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Grace Hopper', email, password: 'correct horse battery staple' }),
  });
  const cookie = response.headers.get('set-cookie')?.split(';', 1)[0];
  if (!cookie) throw new Error('Registration did not return a session cookie');
  return cookie;
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
    const updateResponse = await app.request('/api/users/me', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ name: 'Grace Brewster Hopper', email: updatedEmail }),
    });
    expect(updateResponse.status).toBe(200);
    await expect(updateResponse.json()).resolves.toMatchObject({
      success: true,
      data: { user: { email: updatedEmail, name: 'Grace Brewster Hopper' } },
    });
  });

  it('rejects an invalid email without mutating the current profile', async () => {
    const email = `${randomUUID()}@example.com`;
    const cookie = await registerUser(email);

    const updateResponse = await app.request('/api/users/me', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ name: 'Grace Brewster Hopper', email: 'not-an-email' }),
    });
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
});
