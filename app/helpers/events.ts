import { eventDispatcher, Event, EventListener } from '@events';

/**
 * Emit an event
 *
 * @example
 * event(new UserRegistered({ user }));
 */
export function event<TPayload>(event: Event<TPayload>): Promise<void> {
  return eventDispatcher.emit(event);
}

/**
 * Register an event listener
 *
 * @example
 * on(UserRegistered, async (event) => {
 *   console.log('User registered:', event.payload.user.email);
 * });
 */
export function on<TPayload>(
  eventClass: new (...args: unknown[]) => Event<TPayload>,
  listener: EventListener<TPayload>
): () => void {
  return eventDispatcher.on(eventClass, listener);
}

/**
 * Register a one-time event listener
 *
 * @example
 * once(UserRegistered, (event) => {
 *   console.log('First user registered!');
 * });
 */
export function once<TPayload>(
  eventClass: new (...args: unknown[]) => Event<TPayload>,
  listener: EventListener<TPayload>
): void {
  eventDispatcher.once(eventClass, listener);
}

/**
 * Remove an event listener
 *
 * @example
 * const unsubscribe = on(UserRegistered, handler);
 * off(UserRegistered, handler);
 * // or: unsubscribe();
 */
export function off<TPayload>(
  eventClass: new (...args: unknown[]) => Event<TPayload>,
  listener: EventListener<TPayload>
): void {
  eventDispatcher.off(eventClass, listener);
}
