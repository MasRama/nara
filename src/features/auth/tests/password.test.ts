import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { app } from '../../../app/server';
import { getDatabase } from '../../../shared/database';
import { csrfHeaders, issueCsrf, mergeResponseCookies } from '../../../shared/security/tests/helpers';
import { comparePassword, hashPassword } from '../server/service';

describe('auth password migration', () => {

  it('derives and verifies password hashes asynchronously', async () => {
    const pending = hashPassword('non-blocking password');
    expect(pending).toBeInstanceOf(Promise);
    const hash = await pending;
    await expect(comparePassword('non-blocking password', hash)).resolves.toBe(true);
    await expect(comparePassword('wrong password', hash)).resolves.toBe(false);
  });

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

  it('blocks temporary-password sessions until the user changes that credential', async () => {
    const email = `${randomUUID()}@example.com`;
    const oldPassword = 'temporary bootstrap password';
    const newPassword = 'replacement bootstrap password';
    const json = { 'Content-Type': 'application/json' };

    const bootstrap = await issueCsrf(app);
    const registerResponse = await app.request('/api/auth/register', {
      method: 'POST',
      headers: { ...csrfHeaders(bootstrap), ...json },
      body: JSON.stringify({ name: 'Temporary User', email, password: oldPassword }),
    });
    const sessionCookie = mergeResponseCookies(bootstrap.cookie, registerResponse);
    getDatabase().prepare('UPDATE users SET must_change_password = 1 WHERE email = ?').run(email);

    const me = await app.request('/api/auth/me', { headers: { Cookie: sessionCookie } });
    expect(me.status).toBe(200);
    await expect(me.json()).resolves.toMatchObject({ data: { user: { mustChangePassword: true } } });

    const blocked = await app.request('/api/users/me', { headers: { Cookie: sessionCookie } });
    expect(blocked.status).toBe(403);
    await expect(blocked.json()).resolves.toMatchObject({ code: 'PASSWORD_CHANGE_REQUIRED' });

    const changeState = await issueCsrf(app, sessionCookie);
    const changeResponse = await app.request('/api/auth/change-password', {
      method: 'POST',
      headers: { ...csrfHeaders(changeState), ...json },
      body: JSON.stringify({ current_password: oldPassword, new_password: newPassword }),
    });
    expect(changeResponse.status).toBe(200);
    const changedCookie = mergeResponseCookies(changeState.cookie, changeResponse);

    const refreshed = await app.request('/api/auth/me', { headers: { Cookie: changedCookie } });
    await expect(refreshed.json()).resolves.toMatchObject({ data: { user: { mustChangePassword: false } } });
    expect((await app.request('/api/users/me', { headers: { Cookie: changedCookie } })).status).toBe(200);
  });
});
