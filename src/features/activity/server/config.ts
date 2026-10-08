import { z } from 'zod';
import { readFeatureEnv } from '../../../shared/config';

const environment = readFeatureEnv('activity', {
  /** Days to keep activity events; 0 keeps them indefinitely. */
  ACTIVITY_RETENTION_DAYS: z.coerce.number().int().min(0).max(36_500).default(365),
});

export const ACTIVITY = {
  RETENTION_DAYS: environment.ACTIVITY_RETENTION_DAYS,
  /** Most events one retention pass deletes, so a backlog never blocks the database. */
  PRUNE_LIMIT: 10_000,
} as const;
