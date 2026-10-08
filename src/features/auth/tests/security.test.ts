import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { app } from '../../../app/server';
import { csrfHeaders, issueCsrf, mergeResponseCookies } from '../../../shared/security/tests/helpers';
import { totpCode, totpStep, verifyTotp } from '../server/totp';

const PASSWORD = 'correct horse battery staple';
const JSON_HEADERS = { 'Content-Type': 'application/json' };

interface Browser {
  cookie: string;
  ip: string;
}

function newBrowser(): Browser {
  return { cookie: '', ip: `198.51.100.${Math.floor(Math.random() * 250) + 1}:${randomUUID()}` };
}

async function send(browser: Browser, path: string, init: { method?: string; body?: unknown; userAgent?: string } = {}) {
  const method = init.method ?? 'GET';
  const extra: Record<string, string> = { 'x-test-ip': browser.ip, 'User-Agent': init.userAgent ?? 'vitest-agent' };
  let headers: Record<string, string> = { ...extra, Cookie: browser.cookie };
  if (method !== 'GET') {
    const state = await issueCsrf(app, browser.cookie || undefined);
    browser.cookie = state.cookie;
    headers = csrfHeaders(state, { ...extra, ...JSON_HEADERS });
  }
  const response = await app.request(path, {
    method,
    headers,
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  browser.cookie = mergeResponseCookies(browser.cookie, response);
  return { status: response.status, body: (await response.json()) as Record<string, any>, response };
}

async function registerAccount(): Promise<{ email: string; browser: Browser }> {
  const email = `${randomUUID()}@example.com`;
  const browser = newBrowser();
  const response = await send(browser, '/api/auth/register', {
    method: 'POST',
    body: { name: 'Grace Hopper', email, password: PASSWORD },
  });
  expect(response.status).toBe(201);
  return { email, browser };
}

async function signIn(email: string, userAgent?: string): Promise<{ browser: Browser; body: Record<string, any> }> {
  const browser = newBrowser();
  const response = await send(browser, '/api/auth/login', { method: 'POST', body: { email, password: PASSWORD }, userAgent });
  expect(response.status).toBe(200);
  return { browser, body: response.body };
}

async function enableTwoFactor(browser: Browser): Promise<{ secret: string; recoveryCodes: string[] }> {
  const setup = await send(browser, '/api/auth/two-factor/setup', { method: 'POST', body: { password: PASSWORD } });
  expect(setup.status).toBe(200);
  const secret = setup.body.data.secret as string;
  expect(setup.body.data.otpauthUrl).toContain(`secret=${secret}`);
  const enabled = await send(browser, '/api/auth/two-factor/enable', {
    method: 'POST',
    body: { code: totpCode(secret, totpStep()) },
  });
  expect(enabled.status).toBe(200);
  return { secret, recoveryCodes: enabled.body.data.recoveryCodes as string[] };
}

const hasSession = (browser: Browser) => /(?:^|; )auth_id=/.test(browser.cookie);

describe('TOTP', () => {
  // RFC 6238 Appendix B SHA-1 vectors, truncated to 6 digits.
  const rfcSecret = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';

  it('matches the RFC 6238 reference codes', () => {
    expect(totpCode(rfcSecret, totpStep(59_000))).toBe('287082');
    expect(totpCode(rfcSecret, totpStep(1_111_111_109_000))).toBe('081804');
    expect(totpCode(rfcSecret, totpStep(2_000_000_000_000))).toBe('279037');
  });

  it('accepts one step of drift but never a step at or before the last used one', () => {
    const now = 1_111_111_109_000;
    const step = totpStep(now);
    expect(verifyTotp(rfcSecret, totpCode(rfcSecret, step - 1), { now })).toBe(step - 1);
    expect(verifyTotp(rfcSecret, totpCode(rfcSecret, step + 1), { now })).toBe(step + 1);
    expect(verifyTotp(rfcSecret, totpCode(rfcSecret, step - 2), { now })).toBeNull();
    expect(verifyTotp(rfcSecret, totpCode(rfcSecret, step), { now, lastUsedStep: step })).toBeNull();
    expect(verifyTotp(rfcSecret, 'abcdef', { now })).toBeNull();
  });
});

describe('device sessions', () => {
  it('keeps each device signed in and lets the owner revoke others by public id', async () => {
    const { email, browser: first } = await registerAccount();
    const { browser: second } = await signIn(email, 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) Chrome/126.0 Safari/537.36');

    expect((await send(first, '/api/auth/me')).status).toBe(200);
    expect((await send(second, '/api/auth/me')).status).toBe(200);

    const listed = await send(first, '/api/auth/sessions');
    const sessions = listed.body.data.sessions as Array<Record<string, unknown>>;
    expect(sessions).toHaveLength(2);
    expect(sessions.filter((session) => session.current)).toHaveLength(1);
    const cookieTokens = [first.cookie, second.cookie].map((jar) => /auth_id=([^;]+)/.exec(jar)![1]);
    for (const session of sessions) expect(cookieTokens).not.toContain(session.id);
    const other = sessions.find((session) => !session.current)!;
    expect(other.userAgent).toContain('Chrome/126.0');

    const current = sessions.find((session) => session.current)!;
    expect((await send(first, `/api/auth/sessions/${String(current.id)}`, { method: 'DELETE' })).status).toBe(409);
    expect((await send(first, `/api/auth/sessions/${randomUUID()}`, { method: 'DELETE' })).status).toBe(404);

    expect((await send(first, `/api/auth/sessions/${String(other.id)}`, { method: 'DELETE' })).status).toBe(200);
    expect((await send(second, '/api/auth/me')).status).toBe(401);
    expect((await send(first, '/api/auth/me')).status).toBe(200);
  });

  it('cannot revoke another account session by guessing its id', async () => {
    const { browser: owner } = await registerAccount();
    const { browser: intruder } = await registerAccount();
    const ownerSession = (await send(owner, '/api/auth/sessions')).body.data.sessions[0].id as string;

    expect((await send(intruder, `/api/auth/sessions/${ownerSession}`, { method: 'DELETE' })).status).toBe(404);
    expect((await send(owner, '/api/auth/me')).status).toBe(200);
  });

  it('signs out every other device on revoke-others and on password change', async () => {
    const { email, browser: first } = await registerAccount();
    const { browser: second } = await signIn(email);
    const { browser: third } = await signIn(email);

    const revoked = await send(first, '/api/auth/sessions/revoke-others', { method: 'POST' });
    expect(revoked.body.data.revoked).toBe(2);
    expect((await send(second, '/api/auth/me')).status).toBe(401);
    expect((await send(third, '/api/auth/me')).status).toBe(401);

    const { browser: fourth } = await signIn(email);
    const changed = await send(first, '/api/auth/change-password', {
      method: 'POST',
      body: { current_password: PASSWORD, new_password: `${PASSWORD} two` },
    });
    expect(changed.status).toBe(200);
    expect((await send(fourth, '/api/auth/me')).status).toBe(401);
    expect((await send(first, '/api/auth/me')).status).toBe(200);
  });

  it('replaces rather than orphans the session when the same browser signs in again', async () => {
    const { email, browser } = await registerAccount();
    await send(browser, '/api/auth/login', { method: 'POST', body: { email, password: PASSWORD } });
    expect((await send(browser, '/api/auth/sessions')).body.data.sessions).toHaveLength(1);
  });

  it('requires an authenticated session', async () => {
    expect((await send(newBrowser(), '/api/auth/sessions')).status).toBe(401);
    expect((await send(newBrowser(), '/api/auth/sessions/revoke-others', { method: 'POST' })).status).toBe(401);
  });
});

describe('two-factor authentication', () => {
  it('requires the current password and a valid code before enabling', async () => {
    const { browser } = await registerAccount();
    expect((await send(browser, '/api/auth/two-factor/enable', { method: 'POST', body: { code: '123456' } })).status).toBe(409);
    expect((await send(browser, '/api/auth/two-factor/setup', { method: 'POST', body: { password: 'wrong password' } })).status).toBe(400);

    const setup = await send(browser, '/api/auth/two-factor/setup', { method: 'POST', body: { password: PASSWORD } });
    const secret = setup.body.data.secret as string;
    const wrongCode = String((Number(totpCode(secret, totpStep())) + 500_000) % 1_000_000).padStart(6, '0');
    const rejected = await send(browser, '/api/auth/two-factor/enable', { method: 'POST', body: { code: wrongCode } });
    expect(rejected.status).toBe(422);
    expect((await send(browser, '/api/auth/two-factor')).body.data.twoFactor.enabled).toBe(false);

    const { recoveryCodes } = await (async () => {
      const enabled = await send(browser, '/api/auth/two-factor/enable', { method: 'POST', body: { code: totpCode(secret, totpStep()) } });
      expect(enabled.status).toBe(200);
      return { recoveryCodes: enabled.body.data.recoveryCodes as string[] };
    })();
    expect(recoveryCodes).toHaveLength(10);
    expect(new Set(recoveryCodes).size).toBe(10);
    expect((await send(browser, '/api/auth/two-factor')).body.data.twoFactor).toMatchObject({ enabled: true, recoveryCodesRemaining: 10 });
    expect((await send(browser, '/api/auth/two-factor/setup', { method: 'POST', body: { password: PASSWORD } })).status).toBe(409);
  });

  it('holds sign-in at a challenge until a fresh authenticator code is given', async () => {
    const { email, browser: enrolled } = await registerAccount();
    const { secret } = await enableTwoFactor(enrolled);

    const { browser, body } = await signIn(email);
    expect(body.data).toEqual({ twoFactorRequired: true });
    expect(hasSession(browser)).toBe(false);
    expect((await send(browser, '/api/auth/me')).status).toBe(401);

    const invalid = await send(browser, '/api/auth/two-factor/challenge', { method: 'POST', body: { code: '000000' } });
    expect(invalid.status).toBe(401);
    expect(invalid.body.code).toBe('INVALID_TWO_FACTOR_CODE');

    // The enrollment code consumed the current step; the next step is still inside the window.
    const nextCode = totpCode(secret, totpStep() + 1);
    const accepted = await send(browser, '/api/auth/two-factor/challenge', { method: 'POST', body: { code: nextCode } });
    expect(accepted.status).toBe(200);
    expect(hasSession(browser)).toBe(true);
    expect((await send(browser, '/api/auth/me')).status).toBe(200);

    // The challenge is single-use, and the same code cannot open a second sign-in.
    expect((await send(browser, '/api/auth/two-factor/challenge', { method: 'POST', body: { code: nextCode } })).body.code)
      .toBe('TWO_FACTOR_CHALLENGE_EXPIRED');
    const { browser: replay } = await signIn(email);
    expect((await send(replay, '/api/auth/two-factor/challenge', { method: 'POST', body: { code: nextCode } })).status).toBe(401);
  });

  it('accepts each recovery code exactly once', async () => {
    const { email, browser: enrolled } = await registerAccount();
    const { recoveryCodes } = await enableTwoFactor(enrolled);

    const { browser: first } = await signIn(email);
    const used = await send(first, '/api/auth/two-factor/challenge', {
      method: 'POST',
      body: { recovery_code: recoveryCodes[0]!.toUpperCase() },
    });
    expect(used.status).toBe(200);
    expect((await send(first, '/api/auth/two-factor')).body.data.twoFactor.recoveryCodesRemaining).toBe(9);

    const { browser: second } = await signIn(email);
    expect((await send(second, '/api/auth/two-factor/challenge', { method: 'POST', body: { recovery_code: recoveryCodes[0] } })).status).toBe(401);
  });

  it('ends the challenge after too many invalid codes', async () => {
    const { email, browser: enrolled } = await registerAccount();
    await enableTwoFactor(enrolled);
    const { browser } = await signIn(email);

    const statuses: number[] = [];
    for (let attempt = 0; attempt < 5; attempt += 1) {
      statuses.push((await send(browser, '/api/auth/two-factor/challenge', { method: 'POST', body: { recovery_code: 'aaaaa-aaaaa' } })).status);
    }
    expect(statuses).toEqual([401, 401, 401, 401, 429]);
    expect((await send(browser, '/api/auth/two-factor/challenge', { method: 'POST', body: { recovery_code: 'aaaaa-aaaaa' } })).body.code)
      .toBe('TWO_FACTOR_CHALLENGE_EXPIRED');
  });

  it('rejects a challenge without the challenge cookie', async () => {
    const response = await send(newBrowser(), '/api/auth/two-factor/challenge', { method: 'POST', body: { code: '123456' } });
    expect(response.status).toBe(401);
    expect(response.body.code).toBe('TWO_FACTOR_CHALLENGE_EXPIRED');
  });

  it('regenerates recovery codes and turns off only with the current password', async () => {
    const { email, browser } = await registerAccount();
    const { recoveryCodes: original } = await enableTwoFactor(browser);

    expect((await send(browser, '/api/auth/two-factor/recovery-codes', { method: 'POST', body: { password: 'nope' } })).status).toBe(400);
    const regenerated = await send(browser, '/api/auth/two-factor/recovery-codes', { method: 'POST', body: { password: PASSWORD } });
    const fresh = regenerated.body.data.recoveryCodes as string[];
    expect(fresh.some((code) => original.includes(code))).toBe(false);

    const { browser: stale } = await signIn(email);
    expect((await send(stale, '/api/auth/two-factor/challenge', { method: 'POST', body: { recovery_code: original[1] } })).status).toBe(401);

    expect((await send(browser, '/api/auth/two-factor/disable', { method: 'POST', body: { password: 'nope' } })).status).toBe(400);
    expect((await send(browser, '/api/auth/two-factor/disable', { method: 'POST', body: { password: PASSWORD } })).status).toBe(200);
    const { browser: direct, body } = await signIn(email);
    expect(body.data).toEqual({ twoFactorRequired: false });
    expect(hasSession(direct)).toBe(true);
  });
});
