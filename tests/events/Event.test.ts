import { describe, it, expect } from 'vitest';
import { Event } from '../../app/events/Event';

class UserRegistered extends Event<{ userId: string }> {
  constructor(userId: string) {
    super('user.registered', { userId });
  }
}

describe('Event', () => {
  it('stores name and payload', () => {
    const event = new UserRegistered('user-123');
    expect(event.name).toBe('user.registered');
    expect(event.payload.userId).toBe('user-123');
  });

  it('sets createdAt timestamp on construction', () => {
    const before = Date.now();
    const event = new UserRegistered('user-1');
    const after = Date.now();
    expect(event.createdAt).toBeGreaterThanOrEqual(before);
    expect(event.createdAt).toBeLessThanOrEqual(after);
  });

  it('isPropagationStopped returns false by default', () => {
    const event = new UserRegistered('user-1');
    expect(event.isPropagationStopped()).toBe(false);
  });

  it('stopPropagation sets isPropagationStopped to true', () => {
    const event = new UserRegistered('user-1');
    event.stopPropagation();
    expect(event.isPropagationStopped()).toBe(true);
  });
});
