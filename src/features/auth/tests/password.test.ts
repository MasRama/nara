import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { app } from '../../../app/server';

describe('auth password migration', () => {
  it('changes the password and invalidates the previous credential', async () => {
    const email = `${randomUUID()}@example.com`;
    const oldPassword = 'correct horse battery staple';
    const newPassword = 'new correct horse battery staple';

    const registerResponse = await app.request('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Katherine Johnson', email, password: oldPassword }),
    });
    const sessionCookie = registerResponse.headers.get('set-cookie')?.split(';', 1)[0];
    expect(sessionCookie).toMatch(/^auth_id=.+/);

    const changeResponse = await app.request('/api/auth/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: sessionCookie! },
      body: JSON.stringify({ current_password: oldPassword, new_password: newPassword }),
    });
    expect(changeResponse.status).toBe(200);

    const oldLogin = await app.request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: oldPassword }),
    });
    expect(oldLogin.status).toBe(401);

    const newLogin = await app.request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: newPassword }),
    });
    expect(newLogin.status).toBe(200);
  });
});
