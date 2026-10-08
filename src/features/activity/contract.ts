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

/**
 * Response schemas, built on demand. Routes type their responses against them
 * and contract tests parse real responses with them; they are strict, so an
 * undeclared field fails. Being a function keeps them out of browser bundles,
 * which only need the inferred types.
 */
export function activityResponseSchemas() {
  const record = z.strictObject({
    id: z.string(),
    action: z.string(),
    resource: z.string(),
    actorId: z.string().nullable(),
    targetId: z.string().nullable(),
    targetLabel: z.string().nullable(),
    metadata: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])),
    occurredAt: z.number(),
  });
  return {
    record,
    listSuccess: z.strictObject({
      success: z.literal(true),
      message: z.string(),
      data: z.strictObject({
        activities: z.array(record),
        total: z.number(),
        page: z.number(),
        limit: z.number(),
      }),
    }),
    error: z.strictObject({
      success: z.literal(false),
      message: z.string(),
      code: z.string(),
      errors: z.record(z.string(), z.array(z.string())).optional(),
    }),
  };
}

type ActivityResponseSchemas = ReturnType<typeof activityResponseSchemas>;
export type ActivityRecord = z.infer<ActivityResponseSchemas['record']>;
export type ActivityListSuccess = z.infer<ActivityResponseSchemas['listSuccess']>;
export type ActivityError = z.infer<ActivityResponseSchemas['error']>;
export type ActivityListResponse = ActivityListSuccess | ActivityError;
