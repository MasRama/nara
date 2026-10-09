import type { Hono } from 'hono';
import {
  ACTIVITY_MAINTENANCE,
  ACTIVITY_PERMISSIONS,
  announceActivity,
  createActivityRoutes,
  recordActivity,
  type ActivityRecordInput,
  type ActivityServerHost,
} from '../../features/activity';
import {
  declarePermissions,
  getCurrentUser,
  hasPermission,
  isAdmin,
  SESSION_COOKIE_NAME,
  type AuthActivitySink,
} from '../../features/auth';
import { declareMaintenance } from '../../shared/database';
import { Logger } from '../../shared/logging';

// Auth owns the permission rows; it writes activity.view at startup.
declarePermissions('activity', ACTIVITY_PERMISSIONS);
// Activity prunes its own history once the application runtime starts.
declareMaintenance('activity', ACTIVITY_MAINTENANCE);

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
