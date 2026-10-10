import { getCookie } from 'hono/cookie';
import { createGuard } from '../../../shared/security';
import { isAllowed } from './access';
import { currentUser, SESSION_COOKIE_NAME } from './service';

/** Guards for Auth's own routes; other Features receive the same checks through their host. */
export const sessionGuard = createGuard((context) => {
  const token = getCookie(context, SESSION_COOKIE_NAME);
  const user = currentUser(token);
  return token && user ? { id: user.id, token, user } : undefined;
}, (actor, rule) => isAllowed(actor.id, rule));
