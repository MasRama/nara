import type { Hono } from 'hono';
import {
  ACTIVITY_MAINTENANCE,
  ACTIVITY_PERMISSIONS,
  activityAccess,
  announceActivity,
  createActivityRoutes,
  declareActivity,
  recordActivity,
  type ActivityRecordInput,
  type ActivityServerHost,
} from '../../features/activity';
import {
  declarePermissions,
  getCurrentUser,
  isAllowed,
  SESSION_COOKIE_NAME,
} from '../../features/auth';
import { declareMaintenance } from '../../shared/database';
import type { ActivityReporter } from '../../shared/security';

// Auth owns the permission rows; it writes activity.view at startup.
declarePermissions('activity', ACTIVITY_PERMISSIONS);
// Activity prunes its own history once the application runtime starts.
declareMaintenance('activity', ACTIVITY_MAINTENANCE);

/**
 * Records what other Features report. Each reporting Feature first declares
 * its actions, which label the feed; it can only report those. Activity is
 * best-effort: its failure must not turn an already-committed business
 * mutation into an ambiguous 500 response, so the application decides how a
 * failure is reported.
 */
export function createActivityRecorder(onFailure: (error: Error) => void): ActivityReporter {
  const record = (input: ActivityRecordInput): void => {
    try {
      recordActivity(input);
      announceActivity(activityServerHost);
    } catch (error) {
      onFailure(error instanceof Error ? error : new Error(String(error)));
    }
  };
  return {
    declare: (resource, declarations) => {
      declareActivity(resource, declarations);
      return record;
    },
  };
}

const activityServerHost: ActivityServerHost = {
  sessionCookieName: SESSION_COOKIE_NAME,
  resolveActor: (sessionToken) => {
    const user = getCurrentUser(sessionToken);
    return user ? { id: user.id } : undefined;
  },
  access: activityAccess('activity'),
  allows: (actorId, rule) => isAllowed(actorId, rule),
};

const activityRoutes = createActivityRoutes(activityServerHost);

export default function composeActivityServer(app: Hono): void {
  app.route('/api/activity', activityRoutes);
}
