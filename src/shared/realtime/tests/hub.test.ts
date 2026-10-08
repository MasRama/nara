import { Hono } from 'hono';
import { afterEach, describe, expect, it } from 'vitest';
import {
  closeEventStreams,
  createEventStream,
  openEventStreamCount,
  publish,
  revalidate,
  type Listener,
} from '../index';
import { readEvents } from './helpers';

const signedIn = new Map<string, Listener>();

function streamApp(options: { heartbeatMs?: number; maxPerUser?: number; maxConnections?: number } = {}) {
  const app = new Hono();
  app.get('/events', createEventStream({ resolve: (context) => signedIn.get(context.req.header('x-session') ?? ''), ...options }));
  return app;
}

async function connect(app: Hono, sessionId: string, userId = `user-of-${sessionId}`) {
  signedIn.set(sessionId, { userId, sessionId });
  const response = await app.request('/events', { headers: { 'x-session': sessionId } });
  expect(response.status).toBe(200);
  expect(response.headers.get('content-type')).toContain('text/event-stream');
  const events = readEvents(response);
  expect(await events.next()).toBe('stream.ready');
  return events;
}

afterEach(() => {
  closeEventStreams();
  signedIn.clear();
});

describe('live update hub', () => {
  it('refuses a request nobody is signed in for', async () => {
    const response = await streamApp().request('/events');
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({ success: false, code: 'UNAUTHORIZED' });
  });

  it('sends a topic only to the listeners the publisher picks', async () => {
    const app = streamApp();
    const alice = await connect(app, 'alice-laptop', 'alice');
    const bob = await connect(app, 'bob-phone', 'bob');

    publish('billing.changed', (listener) => listener.userId === 'alice');

    expect(await alice.next()).toBe('billing.changed');
    expect(await bob.next(100)).toBe('timeout');
  });

  it('ends a stream whose session no longer resolves when its owner revalidates', async () => {
    const app = streamApp();
    const revoked = await connect(app, 'revoked', 'alice');
    const kept = await connect(app, 'kept', 'alice');

    signedIn.delete('revoked');
    revalidate((listener) => listener.userId === 'alice');

    expect(await revoked.next()).toBe('stream.ended');
    expect(await revoked.next()).toBe('closed');
    expect(await kept.next(100)).toBe('timeout');
    expect(openEventStreamCount()).toBe(1);
  });

  it('notices an ended session on the heartbeat without anyone revalidating', async () => {
    const app = streamApp({ heartbeatMs: 20 });
    const stream = await connect(app, 'expiring');

    signedIn.delete('expiring');

    expect(await stream.next()).toBe('stream.ended');
  });

  it("closes a user's oldest stream beyond the per-user limit and refuses connections beyond capacity", async () => {
    const app = streamApp({ maxPerUser: 2, maxConnections: 3 });
    const first = await connect(app, 'tab-1', 'alice');
    await connect(app, 'tab-2', 'alice');
    await connect(app, 'tab-3', 'alice');
    expect(await first.next()).toBe('closed');

    await connect(app, 'bob-tab', 'bob');
    signedIn.set('carol-tab', { userId: 'carol', sessionId: 'carol-tab' });
    const refused = await app.request('/events', { headers: { 'x-session': 'carol-tab' } });
    expect(refused.status).toBe(503);
    await expect(refused.json()).resolves.toMatchObject({ code: 'STREAM_CAPACITY' });
  });

  it('forgets a stream the browser closed', async () => {
    const app = streamApp();
    const stream = await connect(app, 'closing-tab');
    expect(openEventStreamCount()).toBe(1);

    await stream.cancel();

    await expect.poll(() => openEventStreamCount()).toBe(0);
  });
});
