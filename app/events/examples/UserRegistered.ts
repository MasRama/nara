import { Event } from '@events';
import type { User } from '@core';

/**
 * Event fired when a new user registers
 */
export class UserRegistered extends Event<{ user: User; timestamp: number }> {
  constructor(payload: { user: User; timestamp?: number }) {
    super('user.registered', {
      ...payload,
      timestamp: payload.timestamp ?? Date.now()
    });
  }
}
