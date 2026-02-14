import { Event } from '@events';
import type { User } from '@core';

/**
 * Event fired when a user is updated
 */
export class UserUpdated extends Event<{ user: User; updatedBy: string; changes: Partial<User>; timestamp: number }> {
  constructor(payload: { user: User; updatedBy: string; changes: Partial<User>; timestamp?: number }) {
    super('user.updated', {
      ...payload,
      timestamp: payload.timestamp ?? Date.now()
    });
  }
}
