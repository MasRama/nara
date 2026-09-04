// @vitest-environment node
import { randomUUID } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { Hono } from 'hono';
import { compress } from 'hono/compress';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { handleError } from './error-handler';
import { getRequestId, normalizeRequestId, requestId } from './observability';
import { app, startSessionCleanup, stopSessionCleanup } from './server';
import { cleanupExpiredSessions } from '../features/auth';
import { getDatabase } from '../shared/database';
import { Logger } from '../shared/logging';
import { env } from '../shared/config';
import { csrfHeaders, issueCsrf } from '../shared/security/tests/helpers';

const SAFE_ID = /^[A-Za-z0-9._~:+-]{1,128}$/;

function seedUser(email = `${randomUUID()}@example.com`): string {
  const id = randomUUID();
  const now = Date.now();
  getDatabase()
    .prepare('INSERT INTO users (id, name, email, password, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
    .run(id, 'Lifecycle Probe', email, 'not-a-real-hash', now, now);
  return id;
}

function seedSession(userId: string, expiresAt: number): string {
  const id = randomUUID();
  getDatabase()
    .prepare('INSERT INTO sessions (id, user_id, user_agent, expires_at, created_at) VALUES (?, ?, ?, ?, ?)')
    .run(id, userId, 'vitest', expiresAt, Date.now());
  return id;
}

function sessionExists(id: string): boolean {
  return getDatabase().prepare('SELECT 1 FROM sessions WHERE id = ?').get(id) !== undefined;
}

afterEach(() => {
  stopSessionCleanup();
  vi.restoreAllMocks();
});

describe('request ID lifecycle', () => {
  it('generates a safe non-empty request ID when none is supplied', async () => {
    const response = await app.request('/api/auth/me');
    const id = response.headers.get('X-Request-Id');
    expect(id).toMatch(SAFE_ID);
  });

  it('propagates a valid incoming request ID unchanged', async () => {
    const sent = `probe-${randomUUID()}`;
    const response = await app.request('/api/auth/me', { headers: { 'X-Request-Id': sent } });
    expect(response.headers.get('X-Request-Id')).toBe(sent);
  });

  it('replaces oversized or unsafe inbound IDs with a generated one', async () => {
    for (const inbound of ['x'.repeat(200), 'not a valid id', 'id;with,unsafe<chars>']) {
      const response = await app.request('/api/auth/me', { headers: { 'X-Request-Id': inbound } });
      const id = response.headers.get('X-Request-Id');
      expect(id, inbound).not.toBe(inbound);
      expect(id, inbound).toMatch(SAFE_ID);
    }
  });

  it('rejects header-injection shapes without reflecting them', () => {
    expect(normalizeRequestId('ok-id_1:~+-.9')).toBe('ok-id_1:~+-.9');
    for (const hostile of ['a\rb', 'a\nb', '', '   ', 'x'.repeat(129)]) {
      const generated = normalizeRequestId(hostile);
      expect(generated).toMatch(SAFE_ID);
      expect(generated).not.toBe(hostile.trim());
    }
  });

  it('keeps the request ID on 401, 403, 404, and 413 responses', async () => {
    const unauthorized = await app.request('/api/auth/me');
    expect(unauthorized.status).toBe(401);
    expect(unauthorized.headers.get('X-Request-Id')).toMatch(SAFE_ID);

    const forbidden = await app.request('/api/auth/register', { method: 'POST' });
    expect(forbidden.status).toBe(403);
    expect(forbidden.headers.get('X-Request-Id')).toMatch(SAFE_ID);

    const missingApi = await app.request('/api/does-not-exist');
    expect(missingApi.status).toBe(404);
    expect(missingApi.headers.get('X-Request-Id')).toMatch(SAFE_ID);

    const state = await issueCsrf(app);
    const big = 'x'.repeat(env.MAX_JSON_BODY_BYTES + 16);
    const tooLarge = await app.request('/api/auth/register', {
      method: 'POST',
      headers: { ...csrfHeaders(state), 'Content-Type': 'application/json', 'Content-Length': String(big.length) },
      body: big,
    });
    expect(tooLarge.status).toBe(413);
    expect(tooLarge.headers.get('X-Request-Id')).toMatch(SAFE_ID);
  });

  it('keeps the request ID on limiter 429 responses', async () => {
    const ip = { 'x-test-ip': `192.0.2.9:${randomUUID()}` };
    const state = await issueCsrf(app);
    for (let attempt = 0; attempt < env.AUTH_RATE_LIMIT_MAX; attempt += 1) {
      await app.request('/api/auth/logout', { method: 'POST', headers: { ...csrfHeaders(state), ...ip } });
    }
    const limited = await app.request('/api/auth/logout', {
      method: 'POST',
      headers: { ...csrfHeaders(state), ...ip },
    });
    expect(limited.status).toBe(429);
    expect(limited.headers.get('X-Request-Id')).toMatch(SAFE_ID);
  });

  it('exposes the ID to downstream handlers through Hono context', async () => {
    const probe = new Hono();
    probe.use('*', requestId());
    probe.get('/id', (context) => context.json({ requestId: getRequestId(context) }));
    const sent = `ctx-${randomUUID()}`;
    const response = await probe.request('/id', { headers: { 'X-Request-Id': sent } });
    await expect(response.json()).resolves.toMatchObject({ requestId: sent });
  });
});

describe('request lifecycle logging', () => {
  it('emits one structured completion event with method, path, status, duration, and request ID', async () => {
    const seen: unknown[][] = [];
    vi.spyOn(Logger, 'info').mockImplementation(((...args: unknown[]) => {
      seen.push(args);
    }) as typeof Logger.info);
    const sent = `log-${randomUUID()}`;
    const response = await app.request('/api/auth/me', { headers: { 'X-Request-Id': sent } });
    expect(response.status).toBe(401);

    const events = seen.filter(([message]) => message === 'HTTP request');
    expect(events).toHaveLength(1);
    const payload = events[0]![1] as Record<string, unknown>;
    expect(payload).toMatchObject({ requestId: sent, method: 'GET', path: '/api/auth/me', status: 401 });
    expect(typeof payload.durationMs).toBe('number');
    const serialized = JSON.stringify(payload);
    expect(serialized).not.toContain('password');
    expect(serialized).not.toContain('csrf');
    expect(serialized).not.toContain('auth_id');
    expect(Object.keys(payload).sort()).toEqual(
      ['durationMs', 'ip', 'method', 'path', 'requestId', 'status', 'userAgent'].sort(),
    );
  });

  it('excludes health and readiness probes from normal lifecycle noise', async () => {
    const seen: unknown[][] = [];
    vi.spyOn(Logger, 'info').mockImplementation(((...args: unknown[]) => {
      seen.push(args);
    }) as typeof Logger.info);
    expect((await app.request('/health')).status).toBe(200);
    expect((await app.request('/ready')).status).toBe(200);
    const paths = seen
      .filter(([message]) => message === 'HTTP request')
      .map(([, payload]) => (payload as Record<string, unknown>).path);
    expect(paths).not.toContain('/health');
    expect(paths).not.toContain('/ready');
  });

  it('still assigns request IDs to health and readiness probes', async () => {
    expect((await app.request('/health')).headers.get('X-Request-Id')).toMatch(SAFE_ID);
    expect((await app.request('/ready')).headers.get('X-Request-Id')).toMatch(SAFE_ID);
  });
});

describe('error correlation', () => {
  it('matches the error log request ID with the 500 response header', async () => {
    const probe = new Hono();
    probe.use('*', requestId());
    probe.onError(handleError);
    probe.get('/boom', () => {
      throw new Error('controlled probe failure');
    });
    const logged: unknown[][] = [];
    vi.spyOn(Logger, 'error').mockImplementation(((...args: unknown[]) => {
      logged.push(args);
    }) as typeof Logger.error);

    const response = await probe.request('/boom');
    expect(response.status).toBe(500);
    const headerId = response.headers.get('X-Request-Id');
    expect(headerId).toMatch(SAFE_ID);
    await expect(response.json()).resolves.toMatchObject({ code: 'INTERNAL_ERROR' });

    const failures = logged.filter(([message]) => message === 'Unhandled application error');
    expect(failures).toHaveLength(1);
    expect((failures[0]![1] as Record<string, unknown>).requestId).toBe(headerId);
  });

  it('never exposes stack traces or internals in production error bodies', async () => {
    const probe = new Hono();
    probe.use('*', requestId());
    probe.onError(handleError);
    probe.get('/boom', () => {
      throw new Error('secret internals must not leak');
    });
    const body = (await (await probe.request('/boom')).json()) as Record<string, unknown>;
    expect(JSON.stringify(body)).not.toContain('secret internals');
    expect(JSON.stringify(body)).not.toContain('at ');
  });
});
describe('production response compression', () => {
  async function gunzipJson(response: Response): Promise<unknown> {
    const raw = Buffer.from(await response.arrayBuffer());
    const encoding = response.headers.get('Content-Encoding');
    const body = encoding === 'gzip' ? gunzipSync(raw) : raw;
    return JSON.parse(body.toString('utf-8'));
  }

  it('compresses an eligible JSON response for gzip clients', async () => {
    const probe = new Hono();
    probe.use('*', compress());
    probe.get('/big', (context) => context.json({ data: 'x'.repeat(4096) }));
    const response = await probe.request('/big', { headers: { 'Accept-Encoding': 'gzip' } });
    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Encoding')).toBe('gzip');
    await expect(gunzipJson(response)).resolves.toMatchObject({ data: 'x'.repeat(4096) });
  });

  it('keeps small API responses valid for gzip clients on the real app', async () => {
    const api = await app.request('/api/auth/me', { headers: { 'Accept-Encoding': 'gzip' } });
    expect(api.status).toBe(401);
    // Like the v2 compression default, bodies without a known length may be
    // compressed regardless of size; API clients decompress transparently.
    await expect(gunzipJson(api)).resolves.toMatchObject({ code: 'UNAUTHORIZED' });
    expect(api.headers.get('X-Request-Id')).toMatch(SAFE_ID);
  });
});

describe('expired session cleanup', () => {
  it('deletes expired sessions at startup while retaining valid ones', async () => {
    const userId = seedUser();
    const expired = seedSession(userId, Date.now() - 1_000);
    const valid = seedSession(userId, Date.now() + 3_600_000);
    const removed = cleanupExpiredSessions();
    expect(removed).toBeGreaterThanOrEqual(1);
    expect(sessionExists(expired)).toBe(false);
    expect(sessionExists(valid)).toBe(true);
  });

  it('removes expired sessions on the scheduled path without hour-long sleeps', async () => {
    const userId = seedUser();
    const expired = seedSession(userId, Date.now() - 1_000);
    const valid = seedSession(userId, Date.now() + 3_600_000);
    const handle = startSessionCleanup({ intervalMs: 15 });
    try {
      // Startup pass already ran synchronously inside startSessionCleanup.
      expect(sessionExists(expired)).toBe(false);
      expect(sessionExists(valid)).toBe(true);
      const later = seedSession(userId, Date.now() - 1_000);
      await vi.waitFor(() => expect(sessionExists(later)).toBe(false), { timeout: 5_000 });
      expect(sessionExists(valid)).toBe(true);
    } finally {
      handle.stop();
    }
  });

  it('is stoppable and safe to stop twice without leaking handles', () => {
    const handle = startSessionCleanup({ intervalMs: 60_000 });
    expect(() => handle.stop()).not.toThrow();
    expect(() => handle.stop()).not.toThrow();
    expect(() => stopSessionCleanup()).not.toThrow();
  });
});
