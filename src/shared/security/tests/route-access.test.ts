import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import {
  ADMINISTRATOR,
  apiRoutes,
  assertApiRoutesDeclareAccess,
  createGuard,
  declareRouteAccess,
  permissionRules,
  publicRoute,
  type AccessRule,
} from '..';

// Actors hold the permissions listed in X-Permissions; `root` is the administrator.
const guard = createGuard(
  (context) => {
    const id = context.req.header('X-Actor');
    return id ? { id, permissions: (context.req.header('X-Permissions') ?? '').split(',') } : undefined;
  },
  (actor, rule: AccessRule) => actor.id === 'root' || ('permission' in rule && actor.permissions.includes(rule.permission)),
);
const things = permissionRules('things', [
  { action: 'create', name: 'Create Things' },
  { action: 'edit', name: 'Edit Things' },
]);

describe('declared route access', () => {
  it('reads the access each mounted route declares, the strictest when several do', () => {
    const feature = new Hono()
      .get('/', guard.signedIn, (context) => context.text('list'))
      .post('/', guard.signedIn, guard.allow(things('create')), (context) => context.text('create'))
      .get('/open', publicRoute, (context) => context.text('open'));
    const app = new Hono();
    app.use('/api/*', async (_context, next) => next());
    app.route('/api/things', feature);
    app.get('/elsewhere', (context) => context.text('not under /api'));

    expect(apiRoutes(app)).toEqual([
      { method: 'GET', path: '/api/things', access: 'signed-in' },
      { method: 'POST', path: '/api/things', access: 'restricted', rule: { permission: 'things.create' } },
      { method: 'GET', path: '/api/things/open', access: 'public' },
    ]);
  });

  it('follows handlers Hono wraps for a sub-application with its own error handler', () => {
    const feature = new Hono().get('/', guard.signedIn, (context) => context.text('ok'));
    feature.onError((_error, context) => context.text('feature error', 500));
    const app = new Hono().route('/api/wrapped', feature);

    expect(apiRoutes(app)).toEqual([{ method: 'GET', path: '/api/wrapped', access: 'signed-in' }]);
  });

  it('counts a handler that declares the access it enforces itself', () => {
    const stream = declareRouteAccess((context: { text: (body: string) => Response }) => context.text('stream'), 'signed-in');
    const app = new Hono().get('/api/events', stream);

    expect(apiRoutes(app)).toEqual([{ method: 'GET', path: '/api/events', access: 'signed-in' }]);
  });

  it('refuses an API route that forgot its guard, naming it', () => {
    const feature = new Hono()
      .get('/', guard.signedIn, (context) => context.text('guarded'))
      .delete('/:id', (context) => context.text('forgot the guard'));
    const app = new Hono().route('/api/billing', feature);

    expect(() => assertApiRoutesDeclareAccess(app)).toThrow(
      'API routes must declare who may call them (a guard, or publicRoute for anyone): DELETE /api/billing/:id.',
    );
  });

  it('accepts an application whose API routes all declare access', () => {
    const app = new Hono().get('/api/csrf', publicRoute, (context) => context.text('token'));

    expect(() => assertApiRoutesDeclareAccess(app)).not.toThrow();
  });

  it('admits callers the rule allows, and nobody else', async () => {
    const app = new Hono()
      .post('/api/things', guard.allow(things('create')), (context) => context.text('created'))
      .delete('/api/things', guard.allow(ADMINISTRATOR), (context) => context.text('deleted'));
    const request = async (method: string, headers: Record<string, string> = {}) =>
      (await app.request('/api/things', { method, headers })).status;

    expect(await request('POST', { 'X-Actor': 'ada', 'X-Permissions': 'things.create' })).toBe(200);
    expect(await request('POST', { 'X-Actor': 'bob', 'X-Permissions': 'things.edit' })).toBe(403);
    expect(await request('POST')).toBe(401);
    expect(await request('DELETE', { 'X-Actor': 'ada', 'X-Permissions': 'things.create' })).toBe(403);
    expect(await request('DELETE', { 'X-Actor': 'root' })).toBe(200);
    expect(apiRoutes(app).map((route) => route.rule)).toEqual([{ permission: 'things.create' }, ADMINISTRATOR]);
  });

  it('hands the request to an extra allowance, so it can depend on the target', async () => {
    const app = new Hono().put(
      '/api/things/:id',
      guard.allow(things('edit'), (actor, context) => actor.id === context.req.param('id')),
      (context) => context.text('edited'),
    );
    const request = async (headers: Record<string, string> = {}) =>
      (await app.request('/api/things/ada', { method: 'PUT', headers })).status;

    expect(await request({ 'X-Actor': 'ada' })).toBe(200);
    expect(await request({ 'X-Actor': 'bob' })).toBe(403);
    expect(await request({ 'X-Actor': 'bob', 'X-Permissions': 'things.edit' })).toBe(200);
    expect(await request()).toBe(401);
  });

  it('refuses rules on a guard that only checks sign-in', () => {
    const signInOnly = createGuard(() => ({ id: 'ada' }));
    expect(() => signInOnly.allow(ADMINISTRATOR)).toThrow('checks sign-in only');
  });
});
