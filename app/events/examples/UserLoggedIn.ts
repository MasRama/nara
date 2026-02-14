import { Event } from '@events';
import type { User } from '@core';

/**
 * Event fired when a user logs in
 */
export class UserLoggedIn extends Event<{ user: User; ip: string; userAgent?: string; timestamp: number }> {
  constructor(payload: { user: User; ip: string; userAgent?: string; timestamp?: number }) {
    super('user.logged_in', {
      ...payload,
      timestamp: payload.timestamp ?? Date.now()
    });
  }
}
