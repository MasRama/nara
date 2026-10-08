import type { Context, MiddlewareHandler } from 'hono';

/**
 * Route guards owned by Users. Installable Features cannot rely on
 * `src/shared/security`, so this mirrors its contract: the host says who the
 * caller is and what they may do, and the guard answers 401/403 before the
 * handler runs.
 */
export interface Guard<A extends { id: string }> {
  /** 401 unless the request resolves to an actor. */
  signedIn: MiddlewareHandler;
  /** 401 without an actor, 403 when the actor is not allowed. */
  allow(allowed: (actor: A) => boolean): MiddlewareHandler;
  /** The actor a guard on this route already resolved; throws on unguarded routes. */
  actor(context: Context): A;
}

export function forbidden(context: Context, message = 'Forbidden', code = 'FORBIDDEN'): Response {
  return context.json({ success: false as const, message, code }, 403);
}

export function createGuard<A extends { id: string }>(resolve: (context: Context) => A | undefined): Guard<A> {
  // Keyed by the request's Context so one resolution serves the guard and handler.
  const resolved = new WeakMap<Context, A>();

  const allow =
    (allowed: (actor: A) => boolean): MiddlewareHandler =>
    async (context, next) => {
      const actor = resolve(context);
      if (!actor) return context.json({ success: false as const, message: 'Unauthorized', code: 'UNAUTHORIZED' }, 401);
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
