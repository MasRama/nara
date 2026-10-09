import { hc } from 'hono/client';
import type { ActivityListResponse } from '../contract';
import type { createActivityRoutes } from '..';

export interface ActivityClient {
  list(input?: {
    page?: number;
    limit?: number;
    action?: string;
    actorId?: string;
    from?: number;
    to?: number;
  }): Promise<ActivityListResponse>;
}

export function createActivityClient(baseUrl = '/api/activity'): ActivityClient {
  const api = hc<ReturnType<typeof createActivityRoutes>>(baseUrl.replace(/\/$/, ''), { init: { credentials: 'include' } });

  return {
    list: async ({ page = 1, limit = 20, action = '', actorId = '', from, to } = {}) =>
      (
        await api.index.$get({
          query: {
            page: String(page),
            limit: String(limit),
            action: action.trim() || undefined,
            actorId: actorId.trim() || undefined,
            from: from === undefined ? undefined : String(from),
            to: to === undefined ? undefined : String(to),
          },
        })
      ).json(),
  };
}
