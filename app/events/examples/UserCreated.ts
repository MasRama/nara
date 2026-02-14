import { Event } from '@events';
import type { User } from '@core';

/**
 * Event fired when a new user is created by admin
 */
export class UserCreated extends Event<{ user: User; createdBy: string; timestamp: number }> {
  constructor(payload: { user: User; createdBy: string; timestamp?: number }) {
    super('user.created', {
      user: payload.user,
      createdBy: payload.createdBy,
      timestamp: payload.timestamp ?? Date.now()
    });
  }
}
