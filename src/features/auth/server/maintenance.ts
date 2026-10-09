import type { MaintenanceTask } from '../../../shared/database';
import { SESSION_CLEANUP_INTERVAL_MS } from './config';
import { cleanupExpiredSessions } from './repository';

/** Auth's upkeep on its own tables; the application starts it after migrations. */
export const AUTH_MAINTENANCE: readonly MaintenanceTask[] = [
  {
    name: 'expired-sessions',
    everyMs: SESSION_CLEANUP_INTERVAL_MS,
    run: (now) => {
      const removed = cleanupExpiredSessions(now);
      return removed > 0 ? { removed } : undefined;
    },
  },
];
