import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import { apiRoutes, assertApiRoutesDeclareAccess, createGuard, declareRouteAccess, publicRoute } from '..';

const guard = createGuard((context) => (context.req.header('X-Actor') ? { id: context.req.header('X-Actor') as string } : undefined));

describe('declared route access', () => {
  it('reads the access each mounted route declares, the strictest when several do', () => {
    const feature = new Hono()
      .get('/', guard.signedIn, (context) => context.text('list'))
      .post('/', guard.signedIn, guard.allow(() => false), (context) => context.text('create'))
      .get('/open', publicRoute, (context) => context.text('open'));
    const app = new Hono();
    app.use('/api/*', async (_context, next) => next());
    app.route('/api/things', feature);
    app.get('/elsewhere', (context) => context.text('not under /api'));

    expect(apiRoutes(app)).toEqual([
      { method: 'GET', path: '/api/things', access: 'signed-in' },
      { method: 'POST', path: '/api/things', access: 'restricted' },
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

  it('hands the request to allow rules, so a rule can depend on the target', async () => {
    const app = new Hono().put(
      '/api/accounts/:id',
      guard.allow((actor, context) => actor.id === context.req.param('id')),
      (context) => context.text('edited'),
    );

    expect((await app.request('/api/accounts/ada', { method: 'PUT', headers: { 'X-Actor': 'ada' } })).status).toBe(200);
    expect((await app.request('/api/accounts/ada', { method: 'PUT', headers: { 'X-Actor': 'bob' } })).status).toBe(403);
    expect((await app.request('/api/accounts/ada', { method: 'PUT' })).status).toBe(401);
  });
});
