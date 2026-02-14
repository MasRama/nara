import { Event } from '@events';

/**
 * Event fired when multiple users are deleted
 */
export class UsersDeleted extends Event<{ ids: string[]; deletedBy: string; count: number; timestamp: number }> {
  constructor(payload: { ids: string[]; deletedBy: string; count: number; timestamp?: number }) {
    super('users.deleted', {
      ...payload,
      timestamp: payload.timestamp ?? Date.now()
    });
  }
}
