// @vitest-environment node
import { randomUUID } from 'node:crypto';
import { rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { app } from '../../../app/server';
import { csrfHeaders, issueCsrf, mergeResponseCookies } from '../../../shared/security/tests/helpers';

const ONE_PIXEL_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
);

async function registerUser(): Promise<string> {
  const bootstrap = await issueCsrf(app);
  const response = await app.request('/api/auth/register', {
    method: 'POST',
    headers: { ...csrfHeaders(bootstrap), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Avatar User',
      email: `${randomUUID()}@example.com`,
      password: 'correct horse battery staple',
    }),
  });
  const cookie = mergeResponseCookies(bootstrap.cookie, response);
  if (!cookie.includes('auth_id=')) throw new Error('Registration did not return a session cookie');
  return cookie;
}

function avatarForm(): FormData {
  const form = new FormData();
  form.set('file', new Blob([ONE_PIXEL_PNG], { type: 'image/png' }), 'avatar.png');
  return form;
}

describe('users asset capability', () => {
  it('validates, processes, stores, and serves an avatar', async () => {
    const cookie = await registerUser();
    const state = await issueCsrf(app, cookie);

    const uploadResponse = await app.request('/api/assets/avatar', {
      method: 'POST',
      headers: { Cookie: state.cookie, 'X-CSRF-Token': state.token },
      body: avatarForm(),
    });
    expect(uploadResponse.status).toBe(200);
    const payload = (await uploadResponse.json()) as { data: { url: string } };
    expect(payload.data.url).toMatch(/^\/api\/assets\/avatar\/[a-f0-9-]+\.webp$/);

    const servedResponse = await app.request(payload.data.url);
    expect(servedResponse.status).toBe(200);
    expect(servedResponse.headers.get('content-type')).toContain('image/webp');
    expect((await servedResponse.arrayBuffer()).byteLength).toBeGreaterThan(0);

    const filename = payload.data.url.split('/').pop();
    if (filename) await rm(resolve(process.cwd(), 'storage', 'avatars', filename), { force: true });
  });

  it('rejects unauthenticated uploads', async () => {
    // A valid CSRF token without a session reaches authentication (401),
    // proving CSRF and session checks compose instead of masking each other.
    const state = await issueCsrf(app);
    const response = await app.request('/api/assets/avatar', {
      method: 'POST',
      headers: { Cookie: state.cookie, 'X-CSRF-Token': state.token },
      body: avatarForm(),
    });
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({ code: 'UNAUTHORIZED' });
  });

  it('rejects uploads without a CSRF token', async () => {
    const response = await app.request('/api/assets/avatar', { method: 'POST', body: avatarForm() });
    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ code: 'CSRF_INVALID' });
  });
});
