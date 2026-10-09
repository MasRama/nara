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
} from '../../features/auth';
import { declareMaintenance } from '../../shared/database';

// Auth owns the permission rows; it writes activity.view at startup.
declarePermissions('activity', ACTIVITY_PERMISSIONS);
// Activity prunes its own history once the application runtime starts.
declareMaintenance('activity', ACTIVITY_MAINTENANCE);

/**
 * Records what another Feature reports. Activity is best-effort: its failure
 * must not turn an already-committed business mutation into an ambiguous 500
 * response, so the application decides how a failure is reported.
 */
export function createActivityRecorder(onFailure: (error: Error) => void): (input: ActivityRecordInput) => void {
  return (input) => {
    try {
      recordActivity(input);
      announceActivity(activityServerHost);
    } catch (error) {
      onFailure(error instanceof Error ? error : new Error(String(error)));
    }
  };
}

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
