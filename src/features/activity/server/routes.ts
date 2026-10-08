import { getCookie } from 'hono/cookie';
import { Hono } from 'hono';
import type { Context } from 'hono';
import { activityQuerySchema, type ActivityError, type ActivityListSuccess } from '../contract';
import type { ActivityServerHost } from './host';
import { listActivity } from './repository';
import { createGuard } from '../../../shared/security';

function validationErrors(error: { issues: Array<{ path: PropertyKey[]; message: string }> }): Record<string, string[]> {
  const errors: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.') || '_root';
    errors[key] ??= [];
    errors[key].push(issue.message);
  }
  return errors;
}

export function createActivityRoutes(host: ActivityServerHost): Hono {
  const guard = createGuard((context) => host.resolveActor(getCookie(context, host.sessionCookieName)));
  return new Hono().get('/', guard.allow((actor) => host.canViewActivity(actor.id)), (context: Context) => {
    const parsed = activityQuerySchema.safeParse({
      page: context.req.query('page') ?? '1',
      limit: context.req.query('limit') ?? '20',
      action: context.req.query('action') || undefined,
      actorId: context.req.query('actorId') || undefined,
      from: context.req.query('from') || undefined,
      to: context.req.query('to') || undefined,
    });
    if (!parsed.success) {
      return context.json(
        {
          success: false as const,
          message: 'Validation failed',
          code: 'VALIDATION_ERROR',
          errors: validationErrors(parsed.error),
        } satisfies ActivityError,
        422,
      );
    }

    const result = listActivity(parsed.data);
    return context.json({
      success: true as const,
      message: 'OK',
      data: {
        activities: result.data,
        total: result.total,
        page: parsed.data.page,
        limit: parsed.data.limit,
      },
    } satisfies ActivityListSuccess);
  });
}
