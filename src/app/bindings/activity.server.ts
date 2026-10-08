import type { Hono } from 'hono';
import {
  announceActivity,
  createActivityRoutes,
  recordActivity,
  type ActivityRecordInput,
  type ActivityServerHost,
} from '../../features/activity';
import {
  getCurrentUser,
  hasPermission,
  isAdmin,
  SESSION_COOKIE_NAME,
  type AuthActivitySink,
} from '../../features/auth';
import { Logger } from '../../shared/logging';

// Activity is best-effort: its failure must not turn an already-committed
// business mutation into an ambiguous 500 response.
export function recordApplicationActivity(input: ActivityRecordInput): void {
  try {
    recordActivity(input);
    announceActivity(activityServerHost);
  } catch (error) {
    Logger.error(
      'Failed to record application activity',
      error instanceof Error ? error : new Error(String(error)),
    );
  }
}

export const authActivitySink: AuthActivitySink = (event) => {
  recordApplicationActivity(event);
};

const activityServerHost: ActivityServerHost = {
  sessionCookieName: SESSION_COOKIE_NAME,
  resolveActor: (sessionToken) => {
    const user = getCurrentUser(sessionToken);
    return user ? { id: user.id } : undefined;
  },
  canViewActivity: (actorId) => isAdmin(actorId) || hasPermission(actorId, 'activity.view'),
};

const activityRoutes = createActivityRoutes(activityServerHost);

export default function composeActivityServer(app: Hono): void {
  app.route('/api/activity', activityRoutes);
}
