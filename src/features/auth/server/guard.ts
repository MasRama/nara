import { getCookie } from 'hono/cookie';
import { createGuard } from '../../../shared/security';
import { hasPermission, isAdmin } from './access';
import { currentUser, SESSION_COOKIE_NAME } from './service';

/** Guards for Auth's own routes; other Features receive the same checks through their host. */
export const sessionGuard = createGuard((context) => {
  const token = getCookie(context, SESSION_COOKIE_NAME);
  const user = currentUser(token);
  return token && user ? { id: user.id, token, user } : undefined;
});

/** `admin` holds every permission. */
export function requirePermission(slug: string) {
  return sessionGuard.allow((actor) => isAdmin(actor.id) || hasPermission(actor.id, slug));
}
