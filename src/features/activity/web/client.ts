import type { ActivityListResponse } from '../contract';

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
  return {
    list: async ({ page = 1, limit = 20, action = '', actorId = '', from, to } = {}) => {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (action.trim()) params.set('action', action.trim());
      if (actorId.trim()) params.set('actorId', actorId.trim());
      if (from !== undefined) params.set('from', String(from));
      if (to !== undefined) params.set('to', String(to));
      return (await fetch(`${baseUrl.replace(/\/$/, '')}?${params.toString()}`, {
        credentials: 'include',
      }).then((response) => response.json())) as ActivityListResponse;
    },
  };
}
