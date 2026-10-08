import { EVENTS_PATH, STREAM_ENDED_EVENT, STREAM_READY_EVENT } from './protocol';

export { STREAM_ENDED_EVENT } from './protocol';

/**
 * The browser side of live updates: one EventSource per page, opened by the
 * application while someone is signed in. Handlers receive no data; they
 * refetch through their Feature's own client. After the connection drops and
 * comes back, every handler runs with `resumed: true`, because events sent
 * while it was down are lost.
 */
export interface ServerEvent {
  resumed: boolean;
}

type Handler = (event: ServerEvent) => void;

const handlers = new Map<string, Set<Handler>>();
let source: EventSource | undefined;
let attached = new Set<string>();
let interrupted = false;

function dispatch(topic: string, event: ServerEvent): void {
  for (const handler of handlers.get(topic) ?? []) handler(event);
}

function attach(topic: string): void {
  if (!source || attached.has(topic) || topic === STREAM_ENDED_EVENT) return;
  attached.add(topic);
  source.addEventListener(topic, () => dispatch(topic, { resumed: false }));
}

function end(): void {
  disconnectServerEvents();
  dispatch(STREAM_ENDED_EVENT, { resumed: false });
}

/** Opens the stream unless it is already open or the browser has no EventSource. */
export function connectServerEvents(): void {
  if (source || typeof EventSource === 'undefined') return;
  source = new EventSource(EVENTS_PATH, { withCredentials: true });
  attached = new Set();
  interrupted = false;

  source.addEventListener(STREAM_READY_EVENT, () => {
    if (!interrupted) return;
    interrupted = false;
    for (const topic of handlers.keys()) dispatch(topic, { resumed: true });
  });
  // The server ended the stream on purpose; reconnecting would only be refused.
  source.addEventListener(STREAM_ENDED_EVENT, end);
  source.addEventListener('error', () => {
    // CONNECTING means the browser retries on its own; CLOSED means it was refused (401, 403, 503).
    if (source?.readyState === EventSource.CLOSED) end();
    else interrupted = true;
  });
  for (const topic of handlers.keys()) attach(topic);
}

export function disconnectServerEvents(): void {
  source?.close();
  source = undefined;
}

/** Runs `handler` for `topic` while subscribed; returns the unsubscribe function. */
export function onServerEvent(topic: string, handler: Handler): () => void {
  const topicHandlers = handlers.get(topic) ?? new Set<Handler>();
  topicHandlers.add(handler);
  handlers.set(topic, topicHandlers);
  attach(topic);
  return () => {
    topicHandlers.delete(handler);
  };
}
