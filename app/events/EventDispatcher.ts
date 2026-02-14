import { Event } from './Event';

/**
 * Event listener type - can be a function or a class with handle method
 */
export type EventListener<TPayload = unknown> =
  | ((event: Event<TPayload>) => void | Promise<void>)
  | { handle: (event: Event<TPayload>) => void | Promise<void> };

/**
 * Event Dispatcher
 *
 * Central hub for registering event listeners and dispatching events.
 * Follows singleton pattern (use eventDispatcher export).
 *
 * @example
 * // Register listener
 * eventDispatcher.on(UserRegistered, async (event) => {
 *   await sendWelcomeEmail(event.payload.user);
 * });
 *
 * // Dispatch event
 * eventDispatcher.emit(new UserRegistered({ user: newUser }));
 */
export class EventDispatcher {
  private listeners = new Map<string, Set<EventListener>>();
  private wildcards: Set<(eventName: string, event: Event) => void> = new Set();

  /**
   * Register an event listener
   *
   * @param eventClass - Event class to listen for
   * @param listener - Function or class with handle method
   * @returns Function to unsubscribe the listener
   *
   * @example
   * const unsubscribe = dispatcher.on(UserRegistered, async (event) => {
   *   console.log('User registered:', event.payload.user.email);
   * });
   *
   * // Later: unsubscribe();
   */
  on<TPayload>(
    eventClass: new (...args: unknown[]) => Event<TPayload>,
    listener: EventListener<TPayload>
  ): () => void {
    // Get event name from a temporary instance
    const tempInstance = Object.create(eventClass.prototype);
    const eventName = this.getEventName(eventClass);

    if (!this.listeners.has(eventName)) {
      this.listeners.set(eventName, new Set());
    }

    const listeners = this.listeners.get(eventName)!;
    listeners.add(listener as EventListener);

    // Return unsubscribe function
    return () => {
      listeners.delete(listener as EventListener);
      if (listeners.size === 0) {
        this.listeners.delete(eventName);
      }
    };
  }

  /**
   * Register a one-time event listener
   */
  once<TPayload>(
    eventClass: new (...args: unknown[]) => Event<TPayload>,
    listener: EventListener<TPayload>
  ): void {
    const wrappedListener: EventListener<TPayload> = (event) => {
      this.off(eventClass, wrappedListener);
      return this.executeListener(listener, event);
    };

    this.on(eventClass, wrappedListener);
  }

  /**
   * Remove an event listener
   */
  off<TPayload>(
    eventClass: new (...args: unknown[]) => Event<TPayload>,
    listener: EventListener<TPayload>
  ): void {
    const eventName = this.getEventName(eventClass);
    const listeners = this.listeners.get(eventName);

    if (listeners) {
      listeners.delete(listener as EventListener);
      if (listeners.size === 0) {
        this.listeners.delete(eventName);
      }
    }
  }

  /**
   * Register a wildcard listener for all events
   */
  onAny(listener: (eventName: string, event: Event) => void | Promise<void>): () => void {
    this.wildcards.add(listener);
    return () => this.wildcards.delete(listener);
  }

  /**
   * Dispatch an event to all registered listeners
   *
   * @param event - Event instance to dispatch
   * @returns Promise that resolves when all listeners complete
   */
  async emit<TPayload>(event: Event<TPayload>): Promise<void> {
    const eventName = event.name;
    const listeners = this.listeners.get(eventName);

    // Execute wildcard listeners
    for (const wildcard of this.wildcards) {
      try {
        await wildcard(eventName, event as Event);
      } catch (error) {
        console.error(`Error in wildcard listener for ${eventName}:`, error);
      }
    }

    // Execute specific listeners
    if (listeners) {
      for (const listener of listeners) {
        if (event.isPropagationStopped()) {
          break;
        }

        try {
          await this.executeListener(listener, event);
        } catch (error) {
          console.error(`Error in event listener for ${eventName}:`, error);
        }
      }
    }
  }

  /**
   * Execute a listener (function or class)
   */
  private async executeListener<TPayload>(
    listener: EventListener<TPayload>,
    event: Event<TPayload>
  ): Promise<void> {
    if (typeof listener === 'function') {
      await listener(event);
    } else {
      await listener.handle(event);
    }
  }

  /**
   * Get event name from event class
   */
  private getEventName<TPayload>(
    eventClass: new (...args: unknown[]) => Event<TPayload>
  ): string {
    // Use class name as event identifier
    return eventClass.name;
  }

  /**
   * Get number of listeners for an event
   */
  listenerCount<TPayload>(
    eventClass: new (...args: unknown[]) => Event<TPayload>
  ): number {
    const eventName = this.getEventName(eventClass);
    return this.listeners.get(eventName)?.size ?? 0;
  }

  /**
   * Check if event has any listeners
   */
  hasListeners<TPayload>(
    eventClass: new (...args: unknown[]) => Event<TPayload>
  ): boolean {
    return this.listenerCount(eventClass) > 0;
  }

  /**
   * Remove all listeners for an event or all events
   */
  removeAllListeners<TPayload>(
    eventClass?: new (...args: unknown[]) => Event<TPayload>
  ): void {
    if (eventClass) {
      const eventName = this.getEventName(eventClass);
      this.listeners.delete(eventName);
    } else {
      this.listeners.clear();
      this.wildcards.clear();
    }
  }
}

// Export singleton instance
export const eventDispatcher = new EventDispatcher();
export default eventDispatcher;
