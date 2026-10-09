/** Wire names shared by the server stream and the browser connection. */
export const EVENTS_PATH = '/api/events';

/** Sent first on every connection; the browser treats a later one as a resumed stream. */
export const STREAM_READY_EVENT = 'stream.ready';

/** Sent before the server closes a stream whose listener no longer resolves (signed out, revoked, expired). */
export const STREAM_ENDED_EVENT = 'stream.ended';

/** How often an open form renews its presence entry; the server lets an entry lapse after 30 s. */
export const PRESENCE_RENEW_MS = 10_000;
