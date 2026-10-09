import { randomUUID } from 'node:crypto';
import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import { env } from '../../shared/config';
import { AVATAR_MAX_FILE_SIZE_BYTES } from '../../features/users';
import { routePolicyFor } from '../../shared/security';
import { app } from '../server';

async function exhaustSensitiveLimit(path: string, ip: Record<string, string>): Promise<Response> {
  for (let attempt = 0; attempt < env.AUTH_RATE_LIMIT_MAX; attempt += 1) {
    await app.request(path, { method: 'POST', headers: ip });
  }
  return app.request(path, { method: 'POST', headers: ip });
}

describe('application route policy', () => {
  it('takes sensitive routes and body budgets from the Features that own them', () => {
    expect(routePolicyFor(app).declared()).toEqual(
      expect.arrayContaining([
        { path: '/api/auth/login' },
        { path: '/api/auth/register' },
        { path: '/api/auth/change-password' },
        { path: '/api/auth/logout' },
        { path: '/api/auth/two-factor/*' },
        { method: 'POST', path: '/api/assets/avatar' },
      ]),
    );
  });

  // A typo in a declared path would silently drop its protection.
  it('declares only paths that a mounted route answers', () => {
    const routes = app.routes.filter((route) => route.method !== 'ALL');
    const unmatched = routePolicyFor(app)
      .declared()
      .filter(({ method, path }) => {
        const wildcard = path.endsWith('/*');
        const base = wildcard ? path.slice(0, -2) : path;
        return !routes.some(
          (route) =>
            (!method || route.method === method) &&
            (route.path === base || (wildcard && route.path.startsWith(`${base}/`))),
        );
      });
    expect(unmatched).toEqual([]);
  });

  // Without its budget an avatar over the JSON limit would be refused before
  // Users' own file check, and no other test uploads one that large.
  it('gives the avatar upload its declared request budget', async () => {
    const uploadBudget = AVATAR_MAX_FILE_SIZE_BYTES + 256 * 1024;
    const budgetAt = async (method: string) => {
      let budget: number | undefined;
      const probe = new Hono();
      probe.all('*', (context) => {
        budget = routePolicyFor(app).bodyBudget(context);
        return context.body(null, 204);
      });
      await probe.request('/api/assets/avatar', { method });
      return budget;
    };
    await expect(budgetAt('POST')).resolves.toBe(uploadBudget);
    await expect(budgetAt('PUT')).resolves.toBeUndefined();
  });

  it('counts the avatar upload toward the sensitive limit', async () => {
    const limited = await exhaustSensitiveLimit('/api/assets/avatar', { 'x-test-ip': `192.0.2.20:${randomUUID()}` });
    expect(limited.status).toBe(429);
  });

  it('limits an encoded spelling of a sensitive path', async () => {
    const limited = await exhaustSensitiveLimit('/api/auth/%6cogin', { 'x-test-ip': `192.0.2.21:${randomUUID()}` });
    expect(limited.status).toBe(429);
  });
});
