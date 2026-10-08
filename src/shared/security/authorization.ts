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
  allow(allowed: (actor: A) => boolean): MiddlewareHandler;
  /** The actor a guard on this route already resolved; throws on unguarded routes. */
  actor(context: Context): A;
}

export function unauthorized(context: Context): Response {
  return context.json({ success: false as const, message: 'Unauthorized', code: 'UNAUTHORIZED' }, 401);
}

export function forbidden(context: Context, message = 'Forbidden', code = 'FORBIDDEN'): Response {
  return context.json({ success: false as const, message, code }, 403);
}

export function createGuard<A extends Actor>(resolve: (context: Context) => A | undefined): Guard<A> {
  // Keyed by the request's Context so one resolution serves the guard and handler.
  const resolved = new WeakMap<Context, A>();

  const allow =
    (allowed: (actor: A) => boolean): MiddlewareHandler =>
    async (context, next) => {
      const actor = resolve(context);
      if (!actor) return unauthorized(context);
      if (!allowed(actor)) return forbidden(context);
      resolved.set(context, actor);
      await next();
    };

  return {
    signedIn: allow(() => true),
    allow,
    actor(context) {
      const actor = resolved.get(context);
      if (!actor) throw new Error('Route reads the actor without a guard');
      return actor;
    },
  };
}
