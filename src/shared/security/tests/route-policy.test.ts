import { Hono, type Context } from 'hono';
import { describe, expect, it } from 'vitest';
import { declareRoutePolicies, routePolicyFor, type RoutePolicy } from '../route-policy';

/** Answers what the registry decides for one request, from inside a real Hono pipeline. */
async function decide(app: Hono, method: string, path: string) {
  const policy = routePolicyFor(app);
  let seen: { sensitive: boolean; budget: number | undefined } | undefined;
  const probe = new Hono();
  probe.all('*', (context: Context) => {
    seen = { sensitive: policy.isSensitive(context), budget: policy.bodyBudget(context) };
    return context.body(null, 204);
  });
  await probe.request(path, { method });
  return seen!;
}

const AUTH: RoutePolicy[] = [
  { path: '/login', sensitive: true },
  { path: '/two-factor/*', sensitive: true },
];

describe('declared route policy', () => {
  it('matches a declared path under its mount', async () => {
    const app = new Hono();
    declareRoutePolicies(app, '/api/auth', AUTH);

    expect((await decide(app, 'POST', '/api/auth/login')).sensitive).toBe(true);
    expect((await decide(app, 'POST', '/api/auth/register')).sensitive).toBe(false);
    expect((await decide(app, 'POST', '/api/auth/login/extra')).sensitive).toBe(false);
  });

  it('lets a wildcard cover its base path and everything below it', async () => {
    const app = new Hono();
    declareRoutePolicies(app, '/api/auth', AUTH);

    expect((await decide(app, 'GET', '/api/auth/two-factor')).sensitive).toBe(true);
    expect((await decide(app, 'POST', '/api/auth/two-factor/challenge')).sensitive).toBe(true);
    expect((await decide(app, 'GET', '/api/auth/two-factorx')).sensitive).toBe(false);
  });

  it('matches the decoded path Hono routes on', async () => {
    const app = new Hono();
    declareRoutePolicies(app, '/api/auth', AUTH);

    expect((await decide(app, 'POST', '/api/auth/%6cogin')).sensitive).toBe(true);
  });

  it('gives a body budget only to the declared method and endpoint', async () => {
    const app = new Hono();
    declareRoutePolicies(app, '/api/assets', [{ method: 'POST', path: '/avatar', sensitive: true, bodyMaxBytes: 4096 }]);

    expect(await decide(app, 'POST', '/api/assets/avatar')).toEqual({ sensitive: true, budget: 4096 });
    expect(await decide(app, 'PUT', '/api/assets/avatar')).toEqual({ sensitive: false, budget: undefined });
    expect(await decide(app, 'POST', '/api/assets/other')).toEqual({ sensitive: false, budget: undefined });
  });

  it('reports declared policies with absolute paths', () => {
    const app = new Hono();
    declareRoutePolicies(app, '/api/auth', AUTH);
    declareRoutePolicies(app, '/api/assets', [{ method: 'POST', path: '/avatar', bodyMaxBytes: 4096 }]);

    expect(routePolicyFor(app).declared()).toEqual([
      { path: '/api/auth/login' },
      { path: '/api/auth/two-factor/*' },
      { method: 'POST', path: '/api/assets/avatar' },
    ]);
  });

  it('refuses a budget that does not name exactly one endpoint', () => {
    const app = new Hono();
    expect(() => declareRoutePolicies(app, '/api/assets', [{ path: '/avatar', bodyMaxBytes: 1 }])).toThrow(
      'Body budget for "/api/assets/avatar" must name a method and an exact path.',
    );
    expect(() => declareRoutePolicies(app, '/api/assets', [{ method: 'POST', path: '/files/*', bodyMaxBytes: 1 }])).toThrow(
      'Body budget for "/api/assets/files/*" must name a method and an exact path.',
    );
    expect(() => declareRoutePolicies(app, '/api', [{ path: 'login' }])).toThrow('Route policy path "login" must start with "/".');
  });

  it('refuses two budgets for the same endpoint', () => {
    const app = new Hono();
    declareRoutePolicies(app, '/api/assets', [{ method: 'POST', path: '/avatar', bodyMaxBytes: 1 }]);
    expect(() => declareRoutePolicies(app, '/api/assets', [{ method: 'POST', path: '/avatar', bodyMaxBytes: 2 }])).toThrow(
      'POST /api/assets/avatar already has a body budget.',
    );
  });

  it('keeps each application instance separate', async () => {
    const first = new Hono();
    declareRoutePolicies(first, '/api/auth', AUTH);
    const second = new Hono();

    expect((await decide(second, 'POST', '/api/auth/login')).sensitive).toBe(false);
    expect(routePolicyFor(second).declared()).toEqual([]);
  });
});
