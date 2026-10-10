import { z } from 'zod';
import { API_REFUSAL_CODES } from '../../shared/security/codes';
import type { PermissionDeclaration } from '../../shared/security/permissions';
import { permissionRules, type AccessRule } from '../../shared/security/access';
import { ACTIVITY_KINDS, type ActivityKind, type ActivityMetadataValue } from '../../shared/security/activity';

/** The actions Activity gates; the application's binding declares them to its access-control provider. */
export const ACTIVITY_PERMISSIONS = [
  {
    action: 'view',
    name: 'View Activity',
    description: 'View application authentication and administration activity history',
  },
] as const satisfies readonly PermissionDeclaration[];

/** The rule each Activity capability requires: its route enforces it, the application's navigation reads it. */
export interface ActivityAccess {
  readonly view: AccessRule;
}

/** Activity's policy for the permissions its binding declared under `resource`. */
export function activityAccess(resource: string): ActivityAccess {
  return { view: permissionRules(resource, ACTIVITY_PERMISSIONS)('view') };
}

/** Live update topic: an activity event was recorded; viewers refetch the feed. */
export const ACTIVITY_RECORDED_EVENT = 'activity.recorded';

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

export type { ActivityMetadataValue };
export type ActivityMetadata = Record<string, ActivityMetadataValue>;

/** An action a reporting Feature declared, under its full `<resource>.<action>` slug. */
export interface DeclaredActivity {
  action: string;
  label: string;
  kind: ActivityKind;
}

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
  const declared = z.strictObject({
    action: z.string(),
    label: z.string(),
    kind: z.enum(ACTIVITY_KINDS),
  });
  return {
    record,
    declared,
    listSuccess: z.strictObject({
      success: z.literal(true),
      message: z.string(),
      data: z.strictObject({
        activities: z.array(record),
        total: z.number(),
        page: z.number(),
        limit: z.number(),
        // What reporting Features declared: labels and filter options for the feed.
        actions: z.array(declared),
      }),
    }),
    error: z.strictObject({
      success: z.literal(false),
      message: z.string(),
      // Activity adds no refusal codes of its own.
      code: z.enum(API_REFUSAL_CODES),
      errors: z.record(z.string(), z.array(z.string())).optional(),
    }),
  };
}

type ActivityResponseSchemas = ReturnType<typeof activityResponseSchemas>;
export type ActivityRecord = z.infer<ActivityResponseSchemas['record']>;
export type ActivityListSuccess = z.infer<ActivityResponseSchemas['listSuccess']>;
export type ActivityError = z.infer<ActivityResponseSchemas['error']>;
export type ActivityListResponse = ActivityListSuccess | ActivityError;
