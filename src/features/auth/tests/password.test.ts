import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { app } from '../../../app/server';
import { csrfHeaders, issueCsrf, mergeResponseCookies } from '../../../shared/security/tests/helpers';

describe('auth password migration', () => {
  it('changes the password and invalidates the previous credential', async () => {
    const email = `${randomUUID()}@example.com`;
    const oldPassword = 'correct horse battery staple';
    const newPassword = 'new correct horse battery staple';
    const json = { 'Content-Type': 'application/json' };

    const bootstrap = await issueCsrf(app);
    const registerResponse = await app.request('/api/auth/register', {
      method: 'POST',
      headers: { ...csrfHeaders(bootstrap), ...json },
      body: JSON.stringify({ name: 'Katherine Johnson', email, password: oldPassword }),
    });
    const sessionCookie = mergeResponseCookies(bootstrap.cookie, registerResponse);
    expect(sessionCookie).toContain('auth_id=');

    const changeState = await issueCsrf(app, sessionCookie);
    const changeResponse = await app.request('/api/auth/change-password', {
      method: 'POST',
      headers: { ...csrfHeaders(changeState), ...json },
      body: JSON.stringify({ current_password: oldPassword, new_password: newPassword }),
    });
    expect(changeResponse.status).toBe(200);

    const oldState = await issueCsrf(app);
    const oldLogin = await app.request('/api/auth/login', {
      method: 'POST',
      headers: { ...csrfHeaders(oldState), ...json },
      body: JSON.stringify({ email, password: oldPassword }),
    });
    expect(oldLogin.status).toBe(401);

    const newState = await issueCsrf(app);
    const newLogin = await app.request('/api/auth/login', {
      method: 'POST',
      headers: { ...csrfHeaders(newState), ...json },
      body: JSON.stringify({ email, password: newPassword }),
    });
    expect(newLogin.status).toBe(200);
  });
});
