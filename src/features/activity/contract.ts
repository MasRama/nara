import { z } from 'zod';

const activityFilterSchema = z
  .string()
  .trim()
  .max(120, 'Filter must be at most 120 characters')
  .optional();

export const activityQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(1_000_000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  action: activityFilterSchema,
  actorId: activityFilterSchema,
  from: z.coerce.number().int().nonnegative().optional(),
  to: z.coerce.number().int().nonnegative().optional(),
});

export type ActivityQuery = z.infer<typeof activityQuerySchema>;

export type ActivityMetadataValue = string | number | boolean | null;
export type ActivityMetadata = Record<string, ActivityMetadataValue>;

export interface ActivityRecordInput {
  action: string;
  resource: string;
  actorId: string | null;
  targetId?: string | null;
  targetLabel?: string | null;
  metadata?: ActivityMetadata;
  occurredAt?: number;
}

export interface ActivityRecord {
  id: string;
  action: string;
  resource: string;
  actorId: string | null;
  targetId: string | null;
  targetLabel: string | null;
  metadata: ActivityMetadata;
  occurredAt: number;
}

export interface ActivityListSuccess {
  success: true;
  message: string;
  data: {
    activities: ActivityRecord[];
    total: number;
    page: number;
    limit: number;
  };
}

export interface ActivityError {
  success: false;
  message: string;
  code: string;
  errors?: Record<string, string[]>;
}

export type ActivityListResponse = ActivityListSuccess | ActivityError;
