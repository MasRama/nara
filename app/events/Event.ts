/**
 * Base Event class
 *
 * All events should extend this class for type-safe event handling.
 *
 * @example
 * class UserRegistered extends Event<{ user: UserRecord; timestamp: number }> {
 *   constructor(payload: { user: UserRecord; timestamp?: number }) {
 *     super('user.registered', {
 *       ...payload,
 *       timestamp: payload.timestamp ?? Date.now()
 *     });
 *   }
 * }
 */
export abstract class Event<TPayload = unknown> {
  /**
   * Event name/identifier
   */
  public readonly name: string;

  /**
   * Event payload data
   */
  public readonly payload: TPayload;

  /**
   * Timestamp when event was created
   */
  public readonly createdAt: number;

  /**
   * Whether the event has been stopped from propagating
   */
  private _isPropagationStopped = false;

  constructor(name: string, payload: TPayload) {
    this.name = name;
    this.payload = payload;
    this.createdAt = Date.now();
  }

  /**
   * Stop event propagation to remaining listeners
   */
  stopPropagation(): void {
    this._isPropagationStopped = true;
  }

  /**
   * Check if propagation is stopped
   */
  isPropagationStopped(): boolean {
    return this._isPropagationStopped;
  }
}
