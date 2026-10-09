import type { MaintenanceTask } from '../../../shared/database';
import { ACTIVITY } from './config';
import { pruneActivityBefore } from './repository';

/**
 * Deletes one bounded batch of events older than the retention period.
 * A retention of 0 days keeps activity indefinitely.
 */
export function pruneExpiredActivity(
  now = Date.now(),
  retentionDays: number = ACTIVITY.RETENTION_DAYS,
): { removed: number; retentionDays: number } {
  if (retentionDays === 0) return { removed: 0, retentionDays };
  const removed = pruneActivityBefore(now - retentionDays * 24 * 60 * 60 * 1000, ACTIVITY.PRUNE_LIMIT);
  return { removed, retentionDays };
}

/** Activity's upkeep on its own table; the application starts it after migrations. */
export const ACTIVITY_MAINTENANCE: readonly MaintenanceTask[] = [
  {
    name: 'retention',
    everyMs: ACTIVITY.PRUNE_INTERVAL_MS,
    run: (now) => {
      const { removed, retentionDays } = pruneExpiredActivity(now);
      return removed > 0 ? { removed, retentionDays } : undefined;
    },
  },
];
