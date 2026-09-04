// @vitest-environment node
import { randomUUID } from 'node:crypto';
import { Hono } from 'hono';
import { afterEach, describe, expect, it } from 'vitest';
import { UPLOAD, env } from '../../config';
import { app } from '../../../app/server';
import { apiBodyLimit } from '../body-limit';
import {
  isLockedOut,
  recordFailedAttempt,
  resetLoginThrottle,
  setThrottleMaxKeysForTests,
} from '../../../features/auth/server/login-throttle';
import { csrfProtection } from '../csrf';
import { securityHeaders } from '../headers';
import { clientIp } from '../ip';
import { createRateLimiter } from '../rate-limit';
import { csrfHeaders, issueCsrf, mergeResponseCookies } from './helpers';

const TEST_PASSWORD = 'correct horse battery staple';

function testIp(): Record<string, string> {
  return { 'x-test-ip': `192.0.2.${Math.floor(Math.random() * 250) + 1}:${randomUUID()}` };
}

function uniqueEmail(): string {
  return `${randomUUID()}@example.com`;
}

async function registerWithCsrf(email: string, password = TEST_PASSWORD, name = 'Security Probe') {
  const bootstrap = await issueCsrf(app);
  const response = await app.request('/api/auth/register', {
    method: 'POST',
    headers: { ...csrfHeaders(bootstrap), 'Content-Type': 'application/json', ...testIp() },
    body: JSON.stringify({ name, email, password }),
  });
  const cookie = mergeResponseCookies(bootstrap.cookie, response);
  return { response, cookie, token: bootstrap.token };
}

describe('security headers', () => {
  function probeApp(isProduction: boolean): Hono {
    const probe = new Hono();
    probe.use('*', securityHeaders({ isProduction, viteOrigin: 'http://localhost:5173' }));
    probe.get('/ok', (context) => context.json({ ok: true }));
    probe.get('/boom', () => {
      throw new Error('probe failure');
    });
    probe.onError((_error, context) => context.json({ success: false, message: 'boom' }, 500));
    return probe;
  }

  it('applies the development policy without HSTS', async () => {
    const response = await probeApp(false).request('/ok');
    expect(response.status).toBe(200);
    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(response.headers.get('X-Frame-Options')).toBe('DENY');
    expect(response.headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
    expect(response.headers.get('Permissions-Policy')).toContain('camera=()');
    expect(response.headers.get('Strict-Transport-Security')).toBeNull();
    const csp = response.headers.get('Content-Security-Policy') ?? '';
    expect(csp).toContain(`default-src 'self'`);
    expect(csp).toContain('http://localhost:5173');
    expect(csp).not.toContain('unsafe-eval');
  });

  it('enables HSTS with a conservative max-age only in production', async () => {
    const response = await probeApp(true).request('/ok');
    expect(response.headers.get('Strict-Transport-Security')).toBe('max-age=31536000; includeSubDomains');
    const csp = response.headers.get('Content-Security-Policy') ?? '';
    expect(csp).toContain(`script-src 'self'`);
    expect(csp).not.toContain('unsafe-eval');
    expect(csp).not.toContain('http://localhost:5173');
  });

  it('covers error responses, not just success', async () => {
    const response = await probeApp(false).request('/boom');
    expect(response.status).toBe(500);
    expect(response.headers.get('Content-Security-Policy')).toContain(`default-src 'self'`);
    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
  });

  it('covers real API success, auth failures, CSRF rejections, and misses', async () => {
    const paths = ['/api/auth/me', '/no-such-page', '/api/auth/register'];
    for (const path of paths) {
      const response = await app.request(path, { method: path === '/api/auth/register' ? 'POST' : 'GET' });
      expect(response.headers.get('Content-Security-Policy')).toContain(`default-src 'self'`);
      expect(response.headers.get('X-Frame-Options')).toBe('DENY');
    }
    expect((await app.request('/api/auth/me')).status).toBe(401);
    expect((await app.request('/api/auth/register', { method: 'POST' })).status).toBe(403);
  });

  it('never emits production HSTS in development/test mode', async () => {
    const response = await app.request('/api/auth/me');
    expect(response.headers.get('Strict-Transport-Security')).toBeNull();
  });
});

describe('CSRF double-submit protection', () => {
  it('bootstraps a readable token cookie on safe requests', async () => {
    const response = await app.request('/api/auth/csrf');
    expect(response.status).toBe(200);
    const payload = (await response.json()) as { success: boolean; data: { csrfToken: string } };
    expect(payload.success).toBe(true);
    expect(payload.data.csrfToken.length).toBeGreaterThan(16);
    const setCookie = response.headers.get('set-cookie') ?? '';
    expect(setCookie).toContain('csrf_token=');
    expect(setCookie).toContain('Path=/');
    expect(setCookie).toContain('SameSite=Lax');
    expect(setCookie).not.toContain('HttpOnly');
    expect(payload.data.csrfToken).toContain(setCookie.split('csrf_token=')[1]!.split(';', 1)[0]!);
  });

  it('rejects state-changing requests without a token', async () => {
    const response = await app.request('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Ada Lovelace', email: uniqueEmail(), password: TEST_PASSWORD }),
    });
    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      code: 'CSRF_INVALID',
      message: 'Invalid CSRF token',
    });
  });

  it('rejects cookie-only, header-only, and mismatched tokens', async () => {
    const email = uniqueEmail();
    const state = await issueCsrf(app);
    const body = JSON.stringify({ name: 'Ada Lovelace', email, password: TEST_PASSWORD });

    const cookieOnly = await app.request('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: state.cookie },
      body,
    });
    expect(cookieOnly.status).toBe(403);

    const headerOnly = await app.request('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': state.token },
      body,
    });
    expect(headerOnly.status).toBe(403);

    const mismatched = await app.request('/api/auth/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: state.cookie,
        'X-CSRF-Token': '0'.repeat(state.token.length),
      },
      body,
    });
    expect(mismatched.status).toBe(403);

    const valid = await app.request('/api/auth/register', {
      method: 'POST',
      headers: { ...csrfHeaders(state), 'Content-Type': 'application/json' },
      body,
    });
    expect(valid.status).toBe(201);
  });

  it('leaves safe methods unenforced', async () => {
    const response = await app.request('/api/auth/me');
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({ code: 'UNAUTHORIZED' });
  });

  it('supports the full browser lifecycle: bootstrap, register, login, mutation, logout', async () => {
    const email = uniqueEmail();
    const registered = await registerWithCsrf(email);
    expect(registered.response.status).toBe(201);

    const loginState = await issueCsrf(app, registered.cookie);
    const loginResponse = await app.request('/api/auth/login', {
      method: 'POST',
      headers: { ...csrfHeaders(loginState), 'Content-Type': 'application/json', ...testIp() },
      body: JSON.stringify({ email, password: TEST_PASSWORD }),
    });
    expect(loginResponse.status).toBe(200);
    const sessionCookie = mergeResponseCookies(loginState.cookie, loginResponse);
    const session = await issueCsrf(app, sessionCookie);

    const changeResponse = await app.request('/api/auth/change-password', {
      method: 'POST',
      headers: { ...csrfHeaders(session), 'Content-Type': 'application/json' },
      body: JSON.stringify({ current_password: TEST_PASSWORD, new_password: 'brand new horse battery staple' }),
    });
    expect(changeResponse.status).toBe(200);
    // change-password rotates the session, so the jar must follow the rotation.
    const rotatedSession = await issueCsrf(app, mergeResponseCookies(session.cookie, changeResponse));

    const profileResponse = await app.request('/api/users/me', {
      method: 'PATCH',
      headers: { ...csrfHeaders(rotatedSession), 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Ada Updated', email }),
    });
    expect(profileResponse.status).toBe(200);

    const logoutResponse = await app.request('/api/auth/logout', {
      method: 'POST',
      headers: csrfHeaders(rotatedSession),
    });
    expect(logoutResponse.status).toBe(200);

    // The CSRF cookie survives logout, so the browser is not left broken:
    // the next mutation fails with 401 (no session), not 403 (bad token).
    const afterLogout = await app.request('/api/users/me', {
      method: 'PATCH',
      headers: { ...csrfHeaders(rotatedSession), 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Ada Again', email }),
    });
    expect(afterLogout.status).toBe(401);
  });

  it('protects admin and asset mutations, not just auth', async () => {
    const state = await issueCsrf(app);
    const json = { 'Content-Type': 'application/json' };

    const userMutation = await app.request('/api/users', {
      method: 'POST',
      headers: { ...json, Cookie: state.cookie },
      body: JSON.stringify({ name: 'Nope', email: uniqueEmail(), password: TEST_PASSWORD }),
    });
    expect(userMutation.status).toBe(403);

    const roleMutation = await app.request('/api/roles', {
      method: 'POST',
      headers: { ...json, Cookie: state.cookie },
      body: JSON.stringify({ name: 'Nope', slug: 'nope' }),
    });
    expect(roleMutation.status).toBe(403);

    const form = new FormData();
    form.set('file', new File(['x'], 'x.png', { type: 'image/png' }));
    const avatarMutation = await app.request('/api/assets/avatar', { method: 'POST', body: form });
    expect(avatarMutation.status).toBe(403);
  });
});

describe('rate limiting', () => {
  function isolatedLimiter() {
    let now = 1_000_000;
    const limiter = createRateLimiter({
      maxRequests: 2,
      windowMs: 60_000,
      name: 'test-isolated',
      now: () => now,
    });
    const probe = new Hono();
    probe.use('*', limiter.middleware);
    probe.get('/resource', (context) => context.json({ ok: true }));
    return { probe, advance: (ms: number) => { now += ms; } };
  }

  it('allows requests below the limit with limit metadata', async () => {
    const { probe } = isolatedLimiter();
    const first = await probe.request('/resource');
    expect(first.status).toBe(200);
    expect(first.headers.get('X-RateLimit-Limit')).toBe('2');
    expect(first.headers.get('X-RateLimit-Remaining')).toBe('1');
    expect(first.headers.get('X-RateLimit-Reset')).not.toBeNull();
    const second = await probe.request('/resource');
    expect(second.status).toBe(200);
    expect(second.headers.get('X-RateLimit-Remaining')).toBe('0');
  });

  it('rejects the crossing request with retry metadata and recovers after the window', async () => {
    const { probe, advance } = isolatedLimiter();
    await probe.request('/resource');
    await probe.request('/resource');
    const limited = await probe.request('/resource');
    expect(limited.status).toBe(429);
    await expect(limited.json()).resolves.toMatchObject({ success: false, code: 'RATE_LIMITED' });
    expect(limited.headers.get('Retry-After')).not.toBeNull();
    expect(limited.headers.get('X-RateLimit-Remaining')).toBe('0');
    advance(60_001);
    expect((await probe.request('/resource')).status).toBe(200);
  });

  it('supports exempt paths such as health probes', async () => {
    let now = 0;
    const limiter = createRateLimiter({
      maxRequests: 1,
      windowMs: 60_000,
      name: 'test-exempt',
      skip: (context) => new URL(context.req.url).pathname === '/health',
      now: () => now,
    });
    const probe = new Hono();
    probe.use('*', limiter.middleware);
    probe.get('/health', (context) => context.json({ status: 'ok' }));
    probe.get('/api/data', (context) => context.json({ ok: true }));
    expect((await probe.request('/health')).status).toBe(200);
    expect((await probe.request('/health')).status).toBe(200);
    expect((await probe.request('/api/data')).status).toBe(200);
    expect((await probe.request('/api/data')).status).toBe(429);
    expect(now).toBe(0);
  });

  it('exposes global limit metadata on API responses but not on health probes', async () => {
    const api = await app.request('/api/auth/me');
    expect(api.headers.get('X-RateLimit-Limit')).toBe(String(env.RATE_LIMIT_MAX));
    const health = await app.request('/health');
    expect(health.headers.get('X-RateLimit-Limit')).toBeNull();
    expect((await app.request('/ready')).headers.get('X-RateLimit-Limit')).toBeNull();
  });

  it('applies a tighter auth limit than the general API budget', async () => {
    // Successful logins clear lockout state but still consume the auth rate
    // budget, isolating the limiter from the lockout mechanism.
    const email = uniqueEmail();
    const registered = await registerWithCsrf(email);
    expect(registered.response.status).toBe(201);
    const ip = testIp();
    for (let attempt = 0; attempt < env.AUTH_RATE_LIMIT_MAX; attempt += 1) {
      const state = await issueCsrf(app);
      const response = await app.request('/api/auth/login', {
        method: 'POST',
        headers: { ...csrfHeaders(state), 'Content-Type': 'application/json', ...ip },
        body: JSON.stringify({ email, password: TEST_PASSWORD }),
      });
      expect(response.status).toBe(200);
    }
    const retryState = await issueCsrf(app);
    const limited = await app.request('/api/auth/login', {
      method: 'POST',
      headers: { ...csrfHeaders(retryState), 'Content-Type': 'application/json', ...ip },
      body: JSON.stringify({ email, password: TEST_PASSWORD }),
    });
    expect(limited.status).toBe(429);
    await expect(limited.json()).resolves.toMatchObject({ success: false, code: 'RATE_LIMITED' });
    expect(limited.headers.get('Retry-After')).not.toBeNull();
  });
});

describe('login identifier/IP lockout', () => {
  async function failedLogin(email: string, ip: Record<string, string>, password = 'wrong password') {
    const state = await issueCsrf(app);
    return app.request('/api/auth/login', {
      method: 'POST',
      headers: { ...csrfHeaders(state), 'Content-Type': 'application/json', ...ip },
      body: JSON.stringify({ email, password }),
    });
  }

  it('locks out repeated failures without disclosing account existence', async () => {
    const existing = uniqueEmail();
    const registered = await registerWithCsrf(existing);
    expect(registered.response.status).toBe(201);
    const missing = uniqueEmail();
    const ip = testIp();

    const existingStatuses: number[] = [];
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const response = await failedLogin(existing, ip);
      existingStatuses.push(response.status);
    }
    expect(existingStatuses).toEqual([401, 401, 401, 401, 401]);
    const locked = await app.request('/api/auth/login', {
      method: 'POST',
      headers: { ...csrfHeaders(await issueCsrf(app)), 'Content-Type': 'application/json', ...ip },
      body: JSON.stringify({ email: existing, password: TEST_PASSWORD }),
    });
    expect(locked.status).toBe(429);
    await expect(locked.json()).resolves.toMatchObject({ success: false, code: 'RATE_LIMITED' });

    const missingStatuses: number[] = [];
    const missingIp = testIp();
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const response = await failedLogin(missing, missingIp);
      missingStatuses.push(response.status);
    }
    expect(missingStatuses).toEqual(existingStatuses);
    const missingLocked = await failedLogin(missing, missingIp);
    expect(missingLocked.status).toBe(429);
    await expect(missingLocked.json()).resolves.toMatchObject({ success: false, code: 'RATE_LIMITED' });
  });

  it('locks the identifier across IPs and the IP across identifiers', async () => {
    const email = uniqueEmail();
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const response = await failedLogin(email, { 'x-test-ip': `198.51.100.${attempt + 1}` });
      expect(response.status).toBe(401);
    }
    const freshIp = await failedLogin(email, { 'x-test-ip': '198.51.100.99' });
    expect(freshIp.status).toBe(429);

    const sharedIp = { 'x-test-ip': `203.0.113.${randomUUID().slice(0, 4).replace(/-/g, '1')}` };
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const response = await failedLogin(uniqueEmail(), sharedIp);
      expect(response.status).toBe(401);
    }
    const sharedLocked = await failedLogin(uniqueEmail(), sharedIp);
    expect(sharedLocked.status).toBe(429);
  });

  it('treats identifier casing and whitespace as the same bucket', async () => {
    const email = uniqueEmail();
    const registered = await registerWithCsrf(email);
    expect(registered.response.status).toBe(201);
    const ip = testIp();
    for (let attempt = 0; attempt < 3; attempt += 1) {
      expect((await failedLogin(email, ip)).status).toBe(401);
    }
    // Two failures under different spellings complete the five-attempt
    // budget, proving normalization merges the buckets.
    expect((await failedLogin(`  ${email.toUpperCase()}  `, ip)).status).toBe(401);
    expect((await failedLogin(`  ${email.toUpperCase()}  `, ip)).status).toBe(401);
    const locked = await failedLogin(email, ip);
    expect(locked.status).toBe(429);
  });

  it('resets identifier failure state on successful authentication', async () => {
    const email = uniqueEmail();
    const registered = await registerWithCsrf(email);
    expect(registered.response.status).toBe(201);
    const ip = testIp();
    for (let attempt = 0; attempt < 4; attempt += 1) {
      expect((await failedLogin(email, ip)).status).toBe(401);
    }
    const state = await issueCsrf(app);
    const success = await app.request('/api/auth/login', {
      method: 'POST',
      headers: { ...csrfHeaders(state), 'Content-Type': 'application/json', ...ip },
      body: JSON.stringify({ email, password: TEST_PASSWORD }),
    });
    expect(success.status).toBe(200);

    const afterReset = await failedLogin(email, ip);
    expect(afterReset.status).toBe(401);
    await expect(afterReset.json()).resolves.toMatchObject({
      success: false,
      code: 'INVALID_CREDENTIALS',
      message: 'Invalid email or password',
    });
  });
});

describe('request body limits', () => {
  it('accepts small JSON bodies normally', async () => {
    const { response } = await registerWithCsrf(uniqueEmail());
    expect(response.status).toBe(201);
  });

  it('rejects oversized JSON with a deterministic diagnostic', async () => {
    const state = await issueCsrf(app);
    const big = JSON.stringify({ name: 'x'.repeat(env.MAX_JSON_BODY_BYTES), email: uniqueEmail(), password: TEST_PASSWORD });
    const declared = await app.request('/api/auth/register', {
      method: 'POST',
      headers: {
        ...csrfHeaders(state),
        'Content-Type': 'application/json',
        'Content-Length': String(big.length),
      },
      body: big,
    });
    expect(declared.status).toBe(413);
    await expect(declared.json()).resolves.toMatchObject({
      success: false,
      code: 'PAYLOAD_TOO_LARGE',
    });
  });

  it('rejects oversized streamed bodies without a declared length', async () => {
    const state = await issueCsrf(app);
    const big = JSON.stringify({ name: 'y'.repeat(env.MAX_JSON_BODY_BYTES + 1024), email: uniqueEmail(), password: TEST_PASSWORD });
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(big));
        controller.close();
      },
    });
    const request = new Request('http://localhost/api/auth/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: state.cookie,
        'X-CSRF-Token': state.token,
      },
      body: stream,
      duplex: 'half',
    } as RequestInit);
    const streamed = await app.request(request);
    expect(streamed.status).toBe(413);
    await expect(streamed.json()).resolves.toMatchObject({ code: 'PAYLOAD_TOO_LARGE' });
  });

  it('keeps multipart avatar uploads on their own file-size policy', async () => {
    const email = uniqueEmail();
    const registered = await registerWithCsrf(email);
    expect(registered.response.status).toBe(201);
    const session = await issueCsrf(app, registered.cookie);
    const png = new Uint8Array(
      Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
        'base64',
      ),
    );
    const form = new FormData();
    form.set('file', new Blob([png], { type: 'image/png' }), 'pixel.png');
    const upload = await app.request('/api/assets/avatar', {
      method: 'POST',
      headers: { Cookie: session.cookie, 'X-CSRF-Token': session.token },
      body: form,
    });
    expect(upload.status).toBe(200);
  });
});

describe('input normalization and unsafe keys', () => {
  it('trims and normalizes names and emails', async () => {
    const { response } = await registerWithCsrf('  PADDED@Example.COM  ', TEST_PASSWORD, '  Ada Lovelace  ');
    expect(response.status).toBe(201);
    const payload = (await response.json()) as { data: { user: { name: string; email: string } } };
    expect(payload.data.user.name).toBe('Ada Lovelace');
    expect(payload.data.user.email).toBe('padded@example.com');
  });

  it('rejects control characters in business text', async () => {
    const { response } = await registerWithCsrf(uniqueEmail(), TEST_PASSWORD, `Ada${String.fromCharCode(0)}X`);
    expect(response.status).toBe(422);
  });

  it('never trims or transforms passwords', async () => {
    const email = uniqueEmail();
    const password = '  spaced secret 12  ';
    const registered = await registerWithCsrf(email, password);
    expect(registered.response.status).toBe(201);
    const state = await issueCsrf(app, registered.cookie);
    const login = await app.request('/api/auth/login', {
      method: 'POST',
      headers: { ...csrfHeaders(state), 'Content-Type': 'application/json', ...testIp() },
      body: JSON.stringify({ email, password }),
    });
    expect(login.status).toBe(200);
  });

  it('discards prototype-pollution keys instead of merging them', async () => {
    const email = uniqueEmail();
    const state = await issueCsrf(app);
    const body = JSON.stringify({ name: 'Ada Lovelace', email, password: TEST_PASSWORD });
    const polluted = body.replace('{', '{"__proto__":{"polluted":true},');
    const response = await app.request('/api/auth/register', {
      method: 'POST',
      headers: { ...csrfHeaders(state), 'Content-Type': 'application/json', ...testIp() },
      body: polluted,
    });
    expect(response.status).toBe(201);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });
});

describe('CSRF middleware scope', () => {
  it('enforces only state-changing API requests', async () => {
    const probe = new Hono();
    probe.use('*', csrfProtection({ isProduction: false }));
    probe.get('/api/thing', (context) => context.json({ ok: true }));
    probe.post('/api/thing', (context) => context.json({ ok: true }));
    probe.post('/page', (context) => context.text('ok'));
    expect((await probe.request('/api/thing')).status).toBe(200);
    expect((await probe.request('/api/thing', { method: 'POST' })).status).toBe(403);
    expect((await probe.request('/page', { method: 'POST' })).status).toBe(200);
  });

  it('bounds budgets by route, never by Content-Type', async () => {
    const probe = new Hono();
    probe.use('*', apiBodyLimit({ jsonMaxBytes: 8, uploadMaxBytes: 1024 }));
    probe.post('/api/json', (context) => context.json({ ok: true }));
    probe.post('/api/assets/avatar', (context) => context.json({ ok: true }));
    const blocked = await probe.request('/api/json', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'way too long for eight bytes' }),
    });
    expect(blocked.status).toBe(413);
    // The avatar endpoint owns the larger request budget.
    const form = new FormData();
    form.set('file', new File(['way too long for eight bytes'], 'big.bin'));
    const allowed = await probe.request('/api/assets/avatar', { method: 'POST', body: form });
    expect(allowed.status).toBe(200);
    // An unrelated endpoint gains nothing from declaring multipart.
    const smuggled = await probe.request('/api/json', { method: 'POST', body: form });
    expect(smuggled.status).toBe(413);
  });
});

describe('request body Content-Type bypass', () => {
  async function oversizedRegister(contentType: Record<string, string>, body: string) {
    const state = await issueCsrf(app);
    return app.request('/api/auth/register', {
      method: 'POST',
      headers: {
        ...csrfHeaders(state),
        ...contentType,
        'Content-Length': String(new TextEncoder().encode(body).length),
        ...testIp(),
      },
      body,
    });
  }

  it('rejects oversized JSON sent as text/plain', async () => {
    const big = JSON.stringify({ name: 'x'.repeat(env.MAX_JSON_BODY_BYTES), email: uniqueEmail(), password: TEST_PASSWORD });
    const response = await oversizedRegister({ 'Content-Type': 'text/plain' }, big);
    expect(response.status).toBe(413);
    await expect(response.json()).resolves.toMatchObject({ code: 'PAYLOAD_TOO_LARGE' });
  });

  it('rejects oversized JSON with an alternate JSON-like media type', async () => {
    const big = JSON.stringify({ name: 'x'.repeat(env.MAX_JSON_BODY_BYTES), email: uniqueEmail(), password: TEST_PASSWORD });
    const response = await oversizedRegister({ 'Content-Type': 'application/problem+json' }, big);
    expect(response.status).toBe(413);
    await expect(response.json()).resolves.toMatchObject({ code: 'PAYLOAD_TOO_LARGE' });
  });

  it('rejects oversized streamed JSON without relying on Content-Type', async () => {
    const state = await issueCsrf(app);
    const big = JSON.stringify({ name: 'y'.repeat(env.MAX_JSON_BODY_BYTES + 1024), email: uniqueEmail(), password: TEST_PASSWORD });
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(big));
        controller.close();
      },
    });
    const request = new Request('http://localhost/api/auth/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain',
        Cookie: state.cookie,
        'X-CSRF-Token': state.token,
        ...testIp(),
      },
      body: stream,
      duplex: 'half',
    } as RequestInit);
    const response = await app.request(request);
    expect(response.status).toBe(413);
    await expect(response.json()).resolves.toMatchObject({ code: 'PAYLOAD_TOO_LARGE' });
  });

  it('denies the avatar upload budget to register declaring multipart', async () => {
    const big = JSON.stringify({ name: 'x'.repeat(env.MAX_JSON_BODY_BYTES), email: uniqueEmail(), password: TEST_PASSWORD });
    const response = await oversizedRegister({ 'Content-Type': 'multipart/form-data; boundary=----smuggled' }, big);
    expect(response.status).toBe(413);
    await expect(response.json()).resolves.toMatchObject({ code: 'PAYLOAD_TOO_LARGE' });
  });

  it('denies the avatar upload budget for misleading mixed Content-Type parameters', async () => {
    const big = JSON.stringify({ name: 'x'.repeat(env.MAX_JSON_BODY_BYTES), email: uniqueEmail(), password: TEST_PASSWORD });
    const response = await oversizedRegister({ 'Content-Type': 'application/json; note=multipart/form-data' }, big);
    expect(response.status).toBe(413);
    await expect(response.json()).resolves.toMatchObject({ code: 'PAYLOAD_TOO_LARGE' });
  });

  it('bounds oversized bodies sent without any Content-Type', async () => {
    const state = await issueCsrf(app);
    const big = JSON.stringify({ name: 'x'.repeat(env.MAX_JSON_BODY_BYTES), email: uniqueEmail(), password: TEST_PASSWORD });
    const response = await app.request('/api/auth/register', {
      method: 'POST',
      headers: {
        ...csrfHeaders(state),
        'Content-Length': String(new TextEncoder().encode(big).length),
        ...testIp(),
      },
      body: big,
    });
    // Undici defaults string bodies to text/plain; either way the JSON budget applies.
    expect(response.status).toBe(413);
    await expect(response.json()).resolves.toMatchObject({ code: 'PAYLOAD_TOO_LARGE' });
  });

  it('rejects oversized streamed multipart smuggled to a normal endpoint', async () => {
    const state = await issueCsrf(app);
    const big = new Uint8Array(env.MAX_JSON_BODY_BYTES + 1024).fill(0x61);
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(big);
        controller.close();
      },
    });
    const request = new Request('http://localhost/api/auth/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'multipart/form-data; boundary=----smuggled',
        Cookie: state.cookie,
        'X-CSRF-Token': state.token,
        ...testIp(),
      },
      body: stream,
      duplex: 'half',
    } as RequestInit);
    const response = await app.request(request);
    expect(response.status).toBe(413);
    await expect(response.json()).resolves.toMatchObject({ code: 'PAYLOAD_TOO_LARGE' });
  });

  it('accepts small valid JSON regardless of declared media type', async () => {
    const email = uniqueEmail();
    const state = await issueCsrf(app);
    const response = await app.request('/api/auth/register', {
      method: 'POST',
      headers: { ...csrfHeaders(state), 'Content-Type': 'text/plain', ...testIp() },
      body: JSON.stringify({ name: 'Security Probe', email, password: TEST_PASSWORD }),
    });
    expect(response.status).toBe(201);
  });

  it('denies the upload budget to unrelated endpoints declaring multipart', async () => {
    const probe = new Hono();
    probe.use('*', apiBodyLimit({ jsonMaxBytes: 8, uploadMaxBytes: 1024 }));
    probe.post('/api/upload', (context) => context.json({ ok: true }));
    const form = new FormData();
    form.set('file', new File(['way too long for eight bytes'], 'big.bin'));
    const smuggled = await probe.request('/api/upload', { method: 'POST', body: form });
    expect(smuggled.status).toBe(413);
  });
});

describe('multipart early bound', () => {
  it('rejects oversized multipart requests before full parsing', async () => {
    const email = uniqueEmail();
    const registered = await registerWithCsrf(email);
    expect(registered.response.status).toBe(201);
    const session = await issueCsrf(app, registered.cookie);
    const requestCap = UPLOAD.MAX_FILE_SIZE + 256 * 1024;
    // Declared-length fast path: lies about size without allocating it.
    const declared = await app.request('/api/assets/avatar', {
      method: 'POST',
      headers: {
        Cookie: session.cookie,
        'X-CSRF-Token': session.token,
        'Content-Type': 'multipart/form-data; boundary=----adversarial',
        'Content-Length': String(requestCap + 1024),
        ...testIp(),
      },
      body: '------adversarial--\r\n',
    });
    expect(declared.status).toBe(413);
    await expect(declared.json()).resolves.toMatchObject({ code: 'PAYLOAD_TOO_LARGE' });
  });

  it('enforces the multipart request cap on streamed bodies', async () => {
    const probe = new Hono();
    const cap = 1024;
    probe.use('*', apiBodyLimit({ jsonMaxBytes: 8, uploadMaxBytes: cap }));
    probe.post('/api/assets/avatar', (context) => context.json({ ok: true }));
    const big = new Uint8Array(cap + 512).fill(0x61);
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(big);
        controller.close();
      },
    });
    const request = new Request('http://localhost/api/assets/avatar', {
      method: 'POST',
      headers: { 'Content-Type': 'multipart/form-data; boundary=----probe' },
      body: stream,
      duplex: 'half',
    } as RequestInit);
    expect((await probe.request(request)).status).toBe(413);
  });
});

describe('proxy trust', () => {
  afterEach(() => {
    delete process.env.TRUST_PROXY;
    delete process.env.TRUST_PROXY_HOPS;
  });

  function trustedProbe() {
    const limiter = createRateLimiter({ maxRequests: 1, windowMs: 60_000, name: 'proxy-probe' });
    const probe = new Hono();
    probe.use('*', limiter.middleware);
    probe.get('/api/thing', (context) => context.json({ ok: true }));
    return probe;
  }

  it('ignores forged X-Forwarded-For when trust is disabled', async () => {
    delete process.env.TRUST_PROXY;
    const probe = trustedProbe();
    expect((await probe.request('/api/thing', { headers: { 'X-Forwarded-For': '1.1.1.1' } })).status).toBe(200);
    const second = await probe.request('/api/thing', { headers: { 'X-Forwarded-For': '2.2.2.2' } });
    // Same socket identity shares the bucket despite different forged headers.
    expect(second.status).toBe(429);
  });

  it('derives distinct identities from the trusted suffix when enabled', async () => {
    process.env.TRUST_PROXY = 'true';
    process.env.TRUST_PROXY_HOPS = '1';
    const probe = trustedProbe();
    expect((await probe.request('/api/thing', { headers: { 'X-Forwarded-For': '198.51.100.10' } })).status).toBe(200);
    // Different client through the same documented single proxy gets its own bucket.
    expect((await probe.request('/api/thing', { headers: { 'X-Forwarded-For': '198.51.100.11' } })).status).toBe(200);
  });

  it('does not let an attacker select an arbitrary IP via the leftmost entry', async () => {
    process.env.TRUST_PROXY = 'true';
    process.env.TRUST_PROXY_HOPS = '1';
    const probe = trustedProbe();
    // Documented chain: proxy appends the real peer, so hops=1 honors the last entry.
    expect(
      (await probe.request('/api/thing', { headers: { 'X-Forwarded-For': '9.9.9.9, 198.51.100.77' } })).status,
    ).toBe(200);
    const forgedLeftmost = await probe.request('/api/thing', {
      headers: { 'X-Forwarded-For': '8.8.8.8, 198.51.100.77' },
    });
    // Same effective IP (last entry) shares the bucket; forged leftmost is ignored.
    expect(forgedLeftmost.status).toBe(429);
  });

  it('falls back to socket identity for malformed forwarded headers', async () => {
    process.env.TRUST_PROXY = 'true';
    process.env.TRUST_PROXY_HOPS = '1';
    const probe = new Hono();
    probe.get('/ip', (context) => context.json({ ip: clientIp(context) }));
    const response = await probe.request('/ip', { headers: { 'X-Forwarded-For': 'not-an-ip' } });
    expect(response.status).toBe(200);
    const payload = (await response.json()) as { ip: string };
    expect(payload.ip).not.toBe('not-an-ip');
  });

  it('honors the second-from-right entry with two trusted hops', async () => {
    process.env.TRUST_PROXY = 'true';
    process.env.TRUST_PROXY_HOPS = '2';
    const probe = new Hono();
    probe.get('/ip', (context) => context.json({ ip: clientIp(context) }));
    const response = await probe.request('/ip', {
      headers: { 'X-Forwarded-For': '203.0.113.7, 198.51.100.1, 192.0.2.1' },
    });
    expect(response.status).toBe(200);
    // Two trusted hops: the middle entry is the client behind two proxies.
    await expect(response.json()).resolves.toMatchObject({ ip: '198.51.100.1' });
  });

  it('falls back to socket identity when the chain is shorter than the trust depth', async () => {
    process.env.TRUST_PROXY = 'true';
    process.env.TRUST_PROXY_HOPS = '2';
    const limiterProbe = trustedProbe();
    // One-entry chain with two required hops: no trusted suffix exists, so
    // both requests share the socket bucket and the second is limited.
    expect((await limiterProbe.request('/api/thing', { headers: { 'X-Forwarded-For': '198.51.100.10' } })).status).toBe(
      200,
    );
    expect((await limiterProbe.request('/api/thing', { headers: { 'X-Forwarded-For': '198.51.100.11' } })).status).toBe(
      429,
    );
  });
});

describe('auth limiter logout parity', () => {
  it('applies the tight auth budget to logout', async () => {
    const ip = testIp();
    const state = await issueCsrf(app);
    // Prime the jar once; logout rotates nothing but needs a valid CSRF pair.
    for (let attempt = 0; attempt < env.AUTH_RATE_LIMIT_MAX; attempt += 1) {
      const response = await app.request('/api/auth/logout', {
        method: 'POST',
        headers: { ...csrfHeaders(state), ...ip },
      });
      expect(response.status).toBe(200);
    }
    const limited = await app.request('/api/auth/logout', {
      method: 'POST',
      headers: { ...csrfHeaders(state), ...ip },
    });
    expect(limited.status).toBe(429);
    await expect(limited.json()).resolves.toMatchObject({ code: 'RATE_LIMITED' });
  });
});

describe('limiter store boundedness', () => {
  it('fails closed for unseen identities at saturation without forgiving active buckets', async () => {
    const limiter = createRateLimiter({ maxRequests: 1, windowMs: 60_000, name: 'bounded', maxKeys: 2 });
    const probe = new Hono();
    probe.use('*', limiter.middleware);
    probe.get('/api/thing', (context) => context.json({ ok: true }));
    const via = (ip: string) => probe.request('/api/thing', { headers: { 'x-test-ip': ip } });
    expect((await via('10.0.0.1')).status).toBe(200);
    expect((await via('10.0.0.2')).status).toBe(200);
    // Saturated with active entries: the unseen identity is rejected with a
    // deterministic 429 instead of evicting protected state.
    const saturated = await via('10.0.0.3');
    expect(saturated.status).toBe(429);
    await expect(saturated.json()).resolves.toMatchObject({ code: 'RATE_LIMITED' });
    // Active buckets keep their budget accounting: the throttled identity is
    // still throttled, not silently refilled by churn.
    expect((await via('10.0.0.1')).status).toBe(429);
  });

  it('admits new identities again after expired buckets are swept', async () => {
    let now = Date.now();
    const limiter = createRateLimiter({
      maxRequests: 1,
      windowMs: 1_000,
      name: 'bounded-sweep',
      maxKeys: 1,
      now: () => now,
    });
    const probe = new Hono();
    probe.use('*', limiter.middleware);
    probe.get('/api/thing', (context) => context.json({ ok: true }));
    const via = (ip: string) => probe.request('/api/thing', { headers: { 'x-test-ip': ip } });
    expect((await via('10.0.0.1')).status).toBe(200);
    expect((await via('10.0.0.2')).status).toBe(429);
    now += 2_000;
    expect((await via('10.0.0.2')).status).toBe(200);
  });

  it('preserves active login lockout state under throttle cardinality pressure', async () => {
    resetLoginThrottle();
    // Tiny ceiling: two tracked identities (id + IP keys each) fill the store.
    setThrottleMaxKeysForTests(4);
    try {
      const locked = recordFailedAttempt('locked@example.com', '10.9.9.1');
      // One failure is far below the 5-attempt lockout threshold.
      expect(locked.isLocked).toBe(false);
      // A second identity fills the remaining slots with its own id + IP keys.
      expect(recordFailedAttempt('other@example.com', '10.9.9.2').isLocked).toBe(false);
      // Saturation: the untracked identity fails closed, and the recorded
      // failure state is preserved rather than evicted for churn.
      const saturated = recordFailedAttempt('attacker@example.com', '10.9.9.9');
      expect(saturated.isLocked).toBe(true);
      expect(isLockedOut('locked@example.com', '10.9.9.1')).toBe(false);
      // Four more failures still lock the tracked identity: its counter was
      // never wiped by saturation churn.
      setThrottleMaxKeysForTests(10_000);
      for (let attempt = 0; attempt < 4; attempt += 1) {
        recordFailedAttempt('locked@example.com', '10.9.9.1');
      }
      expect(isLockedOut('locked@example.com', '10.9.9.1')).toBe(true);
    } finally {
      resetLoginThrottle();
    }
  });
});
