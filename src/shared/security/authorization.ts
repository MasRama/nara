import type { Context, MiddlewareHandler } from 'hono';

/**
 * Business-neutral route guards. Features supply who the caller is and what
 * they may do; this module only turns those answers into the standard 401/403
 * responses before the handler runs. It never knows how sessions or
 * permissions are stored, so Features that must not import Auth can still use
 * it through their host.
 */
export interface Actor {
  id: string;
}

export interface Guard<A extends Actor> {
  /** 401 unless the request resolves to an actor. */
  signedIn: MiddlewareHandler;
  /** 401 without an actor, 403 when the actor is not allowed. */
  allow(allowed: (actor: A, context: Context) => boolean): MiddlewareHandler;
  /** The actor a guard on this route already resolved; throws on unguarded routes. */
  actor(context: Context): A;
}

export function unauthorized(context: Context) {
  return context.json({ success: false as const, message: 'Unauthorized', code: 'UNAUTHORIZED' as const }, 401);
}

/** A 403 refusal; `code` stays a literal so clients see exactly which refusal it is. */
export function forbidden<C extends string = 'FORBIDDEN'>(context: Context, message = 'Forbidden', code = 'FORBIDDEN' as C) {
  return context.json({ success: false as const, message, code }, 403);
}

/**
 * Who may reach a route: anyone, any signed-in account, or only accounts a
 * rule admits. Guards record it on the middleware they return, so the
 * application can refuse to start while an API route declares none.
 */
export type RouteAccess = 'public' | 'signed-in' | 'restricted';

const ACCESS_RANK: Record<RouteAccess, number> = { public: 0, 'signed-in': 1, restricted: 2 };
const declaredAccess = new WeakMap<object, RouteAccess>();

/** Records the access a handler enforces itself, for handlers that answer 401/403 without a guard. */
export function declareRouteAccess<H extends object>(handler: H, access: RouteAccess): H {
  declaredAccess.set(handler, access);
  return handler;
}

/** Marks a route anyone may call; an API route without a guard must say so. */
export const publicRoute: MiddlewareHandler = declareRouteAccess(async (_context, next) => {
  await next();
}, 'public');

export function createGuard<A extends Actor>(resolve: (context: Context) => A | undefined): Guard<A> {
  // Keyed by the request's Context so one resolution serves the guard and handler.
  const resolved = new WeakMap<Context, A>();

  const guard = (allowed: (actor: A, context: Context) => boolean): MiddlewareHandler =>
    async (context, next) => {
      const actor = resolve(context);
      if (!actor) return unauthorized(context);
      if (!allowed(actor, context)) return forbidden(context);
      resolved.set(context, actor);
      await next();
    };

  return {
    signedIn: declareRouteAccess(guard(() => true), 'signed-in'),
    allow: (allowed) => declareRouteAccess(guard(allowed), 'restricted'),
    actor(context) {
      const actor = resolved.get(context);
      if (!actor) throw new Error('Route reads the actor without a guard');
      return actor;
    },
  };
}

export interface ApiRoute {
  method: string;
  path: string;
  /** The strictest access its handlers declare; undefined when none does. */
  access: RouteAccess | undefined;
}

/** What these checks read from a Hono application: its flattened route table. */
interface RouteTable {
  readonly routes: ReadonlyArray<{ method: string; path: string; handler: unknown }>;
}

// Hono wraps a mounted sub-application's handlers when it has its own error
// handler, keeping the original under this key.
const COMPOSED_HANDLER = '__COMPOSED_HANDLER';

function accessOf(handler: unknown): RouteAccess | undefined {
  if (typeof handler !== 'function') return undefined;
  return declaredAccess.get(handler) ?? accessOf((handler as unknown as Record<string, unknown>)[COMPOSED_HANDLER]);
}

/** Every route under `prefix`, as mounted, with the access its handlers declare. */
export function apiRoutes(app: RouteTable, prefix = '/api'): ApiRoute[] {
  const routes = new Map<string, ApiRoute>();
  for (const route of app.routes) {
    // `app.use('/api/*', …)` middleware applies to many routes and declares none.
    if (route.method === 'ALL' && route.path.endsWith('*')) continue;
    if (route.path !== prefix && !route.path.startsWith(`${prefix}/`)) continue;
    const key = `${route.method} ${route.path}`;
    const entry = routes.get(key) ?? { method: route.method, path: route.path, access: undefined };
    const access = accessOf(route.handler);
    if (access && (!entry.access || ACCESS_RANK[access] > ACCESS_RANK[entry.access])) entry.access = access;
    routes.set(key, entry);
  }
  return [...routes.values()];
}

/**
 * Throws, naming each route, when an API route declares no access: one that
 * forgot its guard would otherwise answer anyone. Public routes say so with
 * `publicRoute`.
 */
export function assertApiRoutesDeclareAccess(app: RouteTable, prefix = '/api'): void {
  const undeclared = apiRoutes(app, prefix).filter((route) => !route.access);
  if (undeclared.length === 0) return;
  const list = undeclared.map((route) => `${route.method} ${route.path}`).join(', ');
  throw new Error(
    `API routes must declare who may call them (a guard, or publicRoute for anyone): ${list}.`,
  );
}
