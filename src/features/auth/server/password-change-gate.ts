import type { MiddlewareHandler } from 'hono';
import { getCookie } from 'hono/cookie';
import { currentUser, SESSION_COOKIE_NAME } from './service';

/** Auth routes an account with a temporary password still needs, relative to where Auth is mounted. */
export const TEMPORARY_PASSWORD_PATHS = ['/csrf', '/me', '/change-password', '/logout'];

/**
 * Blocks API use until a temporary password is replaced. The application
 * mounts it ahead of every API route and passes the prefix it mounted Auth at,
 * so Auth owns which of its own endpoints stay reachable.
 */
export function passwordChangeGate(authMountPath: string): MiddlewareHandler {
  const allowed = new Set(TEMPORARY_PASSWORD_PATHS.map((path) => `${authMountPath}${path}`));
  return async (context, next) => {
    if (allowed.has(new URL(context.req.url).pathname)) return next();
    if (currentUser(getCookie(context, SESSION_COOKIE_NAME))?.must_change_password === 1) {
      return context.json(
        {
          success: false as const,
          message: 'Change your temporary password before continuing',
          code: 'PASSWORD_CHANGE_REQUIRED' as const,
        },
        403,
      );
    }
    return next();
  };
}
