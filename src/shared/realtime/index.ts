import type { Context, Handler } from 'hono';
import { streamSSE } from 'hono/streaming';
import { unauthorized } from '../security';
import { STREAM_ENDED_EVENT, STREAM_READY_EVENT } from './protocol';

export { EVENTS_PATH, PRESENCE_RENEW_MS, STREAM_ENDED_EVENT, STREAM_READY_EVENT } from './protocol';
export { createPresence, type Editor, type Presence, type PresenceOptions } from './presence';

/**
 * Business-neutral live updates over Server-Sent Events. A Feature publishes
 * a topic to the listeners it picks; the browser then refetches through that
 * Feature's own routes. Events carry no data, so every permission check stays
 * in the route that already makes it.
 *
 * The hub lives in this process only: listeners connected to another server
 * process are not reached.
 */
export interface Listener {
  userId: string;
  sessionId: string;
}

interface Connection {
  readonly listener: Listener;
  /** Resolves the listener again from the original request (cookie), as on connect. */
  resolve(): Listener | undefined;
  /** Settles once the event is written or the stream failed. */
  send(event: string): Promise<void>;
  close(): void;
}

const connections = new Set<Connection>();

const ending = new WeakSet<Connection>();

/** Sends `topic` to every connected listener `to` selects, except streams already ending. */
export function publish(topic: string, to: (listener: Listener) => boolean): void {
  for (const connection of connections) {
    if (!ending.has(connection) && to(connection.listener)) void connection.send(topic);
  }
}

function sameListener(left: Listener | undefined, right: Listener): boolean {
  return left?.userId === right.userId && left.sessionId === right.sessionId;
}

function endIfSignedOut(connection: Connection): boolean {
  if (ending.has(connection)) return true;
  if (sameListener(connection.resolve(), connection.listener)) return false;
  ending.add(connection);
  // Close only after the event is written, so the browser learns why.
  void connection.send(STREAM_ENDED_EVENT).finally(connection.close);
  return true;
}

/**
 * Re-resolves the streams `to` selects right away. A stream whose listener no
 * longer resolves the same way receives `stream.ended` and closes.
 */
export function revalidate(to: (listener: Listener) => boolean): void {
  for (const connection of [...connections]) {
    if (to(connection.listener)) endIfSignedOut(connection);
  }
}

/** Closes every open stream, for shutdown; browsers reconnect on their own. */
export function closeEventStreams(): void {
  for (const connection of [...connections]) connection.close();
}

export function openEventStreamCount(): number {
  return connections.size;
}

export interface EventStreamOptions {
  /** Who is listening; `undefined` answers 401. Also re-run on every heartbeat. */
  resolve(context: Context): Listener | undefined;
  /** Keep-alive comment and re-resolution interval. */
  heartbeatMs?: number;
  /** Open streams per user; connecting beyond it closes that user's oldest. */
  maxPerUser?: number;
  /** Open streams in this process; connecting beyond it answers 503. */
  maxConnections?: number;
}

export function createEventStream(options: EventStreamOptions): Handler {
  const heartbeatMs = options.heartbeatMs ?? 25_000;
  const maxPerUser = options.maxPerUser ?? 10;
  const maxConnections = options.maxConnections ?? 10_000;

  return (context) => {
    const listener = options.resolve(context);
    if (!listener) return unauthorized(context);

    const own = [...connections].filter((connection) => connection.listener.userId === listener.userId);
    for (const connection of own.slice(0, Math.max(0, own.length - maxPerUser + 1))) connection.close();
    if (connections.size >= maxConnections) {
      return context.json(
        { success: false as const, message: 'Too many live connections', code: 'STREAM_CAPACITY' },
        503,
      );
    }

    // Reverse proxies such as nginx otherwise buffer the stream.
    context.header('X-Accel-Buffering', 'no');
    return streamSSE(context, async (stream) => {
      let close!: () => void;
      const closed = new Promise<void>((resolve) => {
        close = resolve;
      });
      const write = (chunk: Promise<unknown>) => chunk.then(() => undefined, close);
      const connection: Connection = {
        listener,
        resolve: () => options.resolve(context),
        send: (event) => write(stream.writeSSE({ event, data: event })),
        close,
      };

      stream.onAbort(close);
      connections.add(connection);
      // Written before anything published to this connection can be.
      void write(stream.writeSSE({ event: STREAM_READY_EVENT, data: STREAM_READY_EVENT, retry: 5_000 }));
      const heartbeat = setInterval(() => {
        if (!endIfSignedOut(connection)) void write(stream.write(': ping\n\n'));
      }, heartbeatMs);
      heartbeat.unref?.();

      try {
        await closed;
      } finally {
        clearInterval(heartbeat);
        connections.delete(connection);
      }
    });
  };
}
