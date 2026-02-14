import { Event } from '@events';
import type { User } from '@core';

/**
 * Event fired when a user logs out
 */
export class UserLoggedOut extends Event<{ user: User; timestamp: number }> {
  constructor(payload: { user: User; timestamp?: number }) {
    super('user.logged_out', {
      ...payload,
      timestamp: payload.timestamp ?? Date.now()
    });
  }
}
