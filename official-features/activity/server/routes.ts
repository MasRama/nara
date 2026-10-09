import { getCookie } from 'hono/cookie';
import { Hono } from 'hono';
import { activityQuerySchema, type ActivityListSuccess } from '../contract';
import type { ActivityServerHost } from './host';
import { declaredActivity } from './catalog';
import { listActivity } from './repository';
import { createGuard, queryInput } from '../../../shared/security';

export function createActivityRoutes(host: ActivityServerHost) {
  const guard = createGuard((context) => host.resolveActor(getCookie(context, host.sessionCookieName)));
  return new Hono().get('/', guard.allow((actor) => host.canViewActivity(actor.id)), queryInput(activityQuerySchema), (context) => {
    const query = context.req.valid('query');
    const result = listActivity(query);
    return context.json({
      success: true as const,
      message: 'OK',
      data: {
        activities: result.data,
        total: result.total,
        page: query.page,
        limit: query.limit,
        actions: declaredActivity(),
      },
    } satisfies ActivityListSuccess);
  });
}
