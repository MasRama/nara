import { randomUUID } from 'node:crypto';
import { afterEach, describe, expect, it } from 'vitest';
import { app } from '../../../app/server';
import { getDatabase, seed } from '../../../shared/database';
import { closeEventStreams, EVENTS_PATH } from '../../../shared/realtime';
import { readEvents, type EventReader } from '../../../shared/realtime/tests/helpers';
import { csrfHeaders, issueCsrf, mergeResponseCookies } from '../../../shared/security/tests/helpers';

/**
 * Live updates through the real application: Auth ends the streams of
 * sessions it removes and tells accounts whose access changed, and Activity
 * announces new events only to accounts allowed to read them.
 */
const PASSWORD = 'correct horse battery staple';

interface Browser {
  cookie: string;
  ip: string;
}

function newBrowser(): Browser {
  return { cookie: '', ip: `198.51.100.${Math.floor(Math.random() * 250) + 1}:${randomUUID()}` };
}

async function send(browser: Browser, path: string, init: { method?: string; body?: unknown } = {}) {
  const method = init.method ?? 'GET';
  let headers: Record<string, string> = { 'x-test-ip': browser.ip, Cookie: browser.cookie };
  if (method !== 'GET') {
    const state = await issueCsrf(app, browser.cookie || undefined);
    browser.cookie = state.cookie;
    headers = csrfHeaders(state, { 'x-test-ip': browser.ip, 'Content-Type': 'application/json' });
  }
  const response = await app.request(path, {
    method,
    headers,
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  browser.cookie = mergeResponseCookies(browser.cookie, response);
  return { status: response.status, body: (await response.json()) as Record<string, any> };
}

async function signUp(): Promise<{ id: string; email: string; browser: Browser }> {
  const browser = newBrowser();
  const email = `${randomUUID()}@example.com`;
  const response = await send(browser, '/api/auth/register', { method: 'POST', body: { name: 'Live Member', email, password: PASSWORD } });
  expect(response.status).toBe(201);
  return { id: response.body.data.user.id as string, email, browser };
}

async function signIn(email: string): Promise<Browser> {
  const browser = newBrowser();
  expect((await send(browser, '/api/auth/login', { method: 'POST', body: { email, password: PASSWORD } })).status).toBe(200);
  return browser;
}

async function signUpAdmin(): Promise<{ id: string; browser: Browser }> {
  const account = await signUp();
  const database = getDatabase();
  const role = database.prepare("SELECT id FROM roles WHERE slug = 'admin'").get() as { id: string } | undefined;
  const roleId = role?.id ?? randomUUID();
  if (!role) {
    database
      .prepare("INSERT INTO roles (id, name, slug, description, created_at, updated_at) VALUES (?, 'Administrator', 'admin', NULL, ?, ?)")
      .run(roleId, Date.now(), Date.now());
  }
  database.prepare('INSERT INTO user_roles (id, user_id, role_id, created_at) VALUES (?, ?, ?, ?)').run(randomUUID(), account.id, roleId, Date.now());
  return account;
}

async function listen(browser: Browser): Promise<EventReader> {
  const response = await app.request(EVENTS_PATH, { headers: { 'x-test-ip': browser.ip, Cookie: browser.cookie } });
  expect(response.status).toBe(200);
  const events = readEvents(response);
  expect(await events.next()).toBe('stream.ready');
  return events;
}

/** Every event that arrives until the stream stays quiet for `quietMs`. */
async function drain(events: EventReader, quietMs = 150): Promise<string[]> {
  const seen: string[] = [];
  for (let event = await events.next(quietMs); event !== 'timeout' && event !== 'closed'; event = await events.next(quietMs)) {
    seen.push(event);
  }
  return seen;
}

afterEach(() => {
  closeEventStreams();
});

describe('live updates', () => {
  it('refuses a stream without a session', async () => {
    const response = await app.request(EVENTS_PATH, { headers: { 'x-test-ip': newBrowser().ip } });
    expect(response.status).toBe(401);
  });

  it('ends the stream of a browser that signs out', async () => {
    const { browser } = await signUp();
    const events = await listen(browser);

    expect((await send(browser, '/api/auth/logout', { method: 'POST' })).status).toBe(200);

    expect(await events.next()).toBe('stream.ended');
    expect(await events.next()).toBe('closed');
  });

  it('ends only the stream of a device signed out from another device', async () => {
    const { email, browser: laptop } = await signUp();
    const phone = await signIn(email);
    const laptopEvents = await listen(laptop);
    const phoneEvents = await listen(phone);

    expect((await send(laptop, '/api/auth/sessions/revoke-others', { method: 'POST' })).status).toBe(200);

    expect(await phoneEvents.next()).toBe('stream.ended');
    expect(await drain(laptopEvents)).not.toContain('stream.ended');
  });

  it('ends every stream of an account whose password an administrator reset or that was deleted', async () => {
    const admin = await signUpAdmin();
    const reset = await signUp();
    const deleted = await signUp();
    const resetEvents = await listen(reset.browser);
    const deletedEvents = await listen(deleted.browser);

    const resetResponse = await send(admin.browser, `/api/users/${reset.id}/reset-password`, {
      method: 'POST',
      body: { password: 'a brand new passphrase' },
    });
    expect(resetResponse.status).toBe(200);
    expect(await resetEvents.next()).toBe('stream.ended');

    expect((await send(admin.browser, '/api/users', { method: 'DELETE', body: { ids: [deleted.id] } })).status).toBe(200);
    expect(await deletedEvents.next()).toBe('stream.ended');
  });

  it("tells an account when its roles or its role's permissions change, and nobody else", async () => {
    seed();
    const admin = await signUpAdmin();
    const member = await signUp();
    const bystander = await signUp();
    const slug = `live-${randomUUID().slice(0, 8)}`;
    const created = await send(admin.browser, '/api/roles', { method: 'POST', body: { name: 'Live Role', slug, permissions: [] } });
    expect(created.status).toBe(201);
    const memberEvents = await listen(member.browser);
    const bystanderEvents = await listen(bystander.browser);

    const assigned = await send(admin.browser, `/api/users/${member.id}`, { method: 'PUT', body: { roles: [slug] } });
    expect(assigned.body).toMatchObject({ success: true });
    expect(await memberEvents.next()).toBe('auth.account-changed');

    const roleId = created.body.data.role.id as string;
    const updated = await send(admin.browser, `/api/roles/${roleId}`, { method: 'PUT', body: { permissions: ['users.view'] } });
    expect(updated.body).toMatchObject({ success: true });
    expect(await memberEvents.next()).toBe('auth.account-changed');

    expect((await send(admin.browser, '/api/roles', { method: 'DELETE', body: { ids: [roleId] } })).status).toBe(200);
    expect(await memberEvents.next()).toBe('auth.account-changed');

    expect(await drain(bystanderEvents)).toEqual([]);
  });

  it("tells an account's other devices when one signs in or out", async () => {
    const { email, browser: laptop } = await signUp();
    const bystander = await signUp();
    const laptopEvents = await listen(laptop);
    const bystanderEvents = await listen(bystander.browser);

    const phone = await signIn(email);
    expect(await laptopEvents.next()).toBe('auth.sessions-changed');

    expect((await send(phone, '/api/auth/logout', { method: 'POST' })).status).toBe(200);
    expect(await laptopEvents.next()).toBe('auth.sessions-changed');
    expect(await drain(laptopEvents)).toEqual([]);

    expect(await drain(bystanderEvents)).toEqual([]);
  });

  it('tells accounts that may read roles when roles or their members change, and nobody else', async () => {
    seed();
    const admin = await signUpAdmin();
    const member = await signUp();
    const adminEvents = await listen(admin.browser);
    const memberEvents = await listen(member.browser);
    const slug = `live-${randomUUID().slice(0, 8)}`;

    const created = await send(admin.browser, '/api/roles', { method: 'POST', body: { name: 'Live Role', slug, permissions: [] } });
    expect(created.status).toBe(201);
    expect(await adminEvents.next()).toBe('auth.roles-changed');

    expect((await send(admin.browser, `/api/users/${member.id}`, { method: 'PUT', body: { roles: [slug] } })).status).toBe(200);
    expect(await drain(adminEvents)).toContain('auth.roles-changed');

    expect(await drain(memberEvents)).not.toContain('auth.roles-changed');
  });

  it('announces recorded activity only to accounts allowed to read it', async () => {
    const admin = await signUpAdmin();
    const member = await signUp();
    const adminEvents = await listen(admin.browser);
    const memberEvents = await listen(member.browser);

    expect((await send(member.browser, '/api/auth/sessions/revoke-others', { method: 'POST' })).status).toBe(200);
    const revokedSomething = await send(admin.browser, `/api/users/${member.id}/reset-password`, {
      method: 'POST',
      body: { password: 'a brand new passphrase' },
    });
    expect(revokedSomething.status).toBe(200);

    expect(await drain(adminEvents)).toContain('activity.recorded');
    expect(await drain(memberEvents)).not.toContain('activity.recorded');
  });
});
