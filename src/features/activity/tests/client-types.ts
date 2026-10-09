import { hc } from 'hono/client';
import type { createActivityRoutes } from '..';

/**
 * Compile-time checks that the web client sees the real route: `npm run lint`
 * fails when the query or response stops matching, including when an
 * `@ts-expect-error` below stops being an error. Never called.
 */
export async function activityRouteTypes(): Promise<void> {
  const activity = hc<ReturnType<typeof createActivityRoutes>>('/api/activity');

  // @ts-expect-error query values travel as strings
  await activity.index.$get({ query: { page: 2 } });
  // @ts-expect-error no such filter
  await activity.index.$get({ query: { resource: 'users' } });

  const listed = await (await activity.index.$get({ query: { page: '1', action: 'auth.login' } })).json();
  const total: number = listed.data.total;
  void total;
  // @ts-expect-error entries carry an actorId, not an actor
  void listed.data.activities[0].actor;
}
