/// <reference lib="dom" />
/// <reference lib="dom.iterable" />
import { createApp, nextTick } from 'vue';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../../../app/App.vue';
import router from '../../../app/router';
import { app as serverApp } from '../../../app/server';
import { csrfHeaders, issueCsrf, mergeResponseCookies } from '../../../shared/security/tests/helpers';
import { createAuthSession, useAuthSession } from '../web';

const TEST_PASSWORD = 'correct horse battery staple';

let container: HTMLDivElement;
let application: { unmount(): void } | undefined;
let cookieJar: Map<string, string>;
let fetchPaths: string[];
let pendingFetches: Set<Promise<Response>>;

function syncDocumentCookies(): void {
  for (const [name, value] of cookieJar) document.cookie = `${name}=${value}`;
}

function adoptCookieString(cookieString: string): void {
  for (const part of cookieString.split(';')) {
    const trimmed = part.trim();
    const separator = trimmed.indexOf('=');
    if (separator <= 0) continue;
    cookieJar.set(trimmed.slice(0, separator), trimmed.slice(separator + 1));
  }
  syncDocumentCookies();
}

function storeResponseCookies(response: Response): void {
  const headers = response.headers as Headers & { getSetCookie?: () => string[] };
  const setCookies =
    typeof headers.getSetCookie === 'function'
      ? headers.getSetCookie()
      : headers.get('set-cookie')
        ? [headers.get('set-cookie') as string]
        : [];
  for (const header of setCookies) {
    const pair = (header.split(';', 1)[0] ?? '').trim();
    const separator = pair.indexOf('=');
    if (separator <= 0) continue;
    const name = pair.slice(0, separator);
    const value = pair.slice(separator + 1);
    if (value.length === 0) cookieJar.delete(name);
    else cookieJar.set(name, value);
  }
  syncDocumentCookies();
}

function cookieHeader(): string | undefined {
  if (cookieJar.size === 0) return undefined;
  return [...cookieJar].map(([name, value]) => `${name}=${value}`).join('; ');
}

function setSessionCookie(value: string | undefined): void {
  if (value === undefined) {
    cookieJar.delete('auth_id');
    document.cookie = 'auth_id=; expires=Thu, 01 Jan 1970 00:00:00 GMT';
  } else {
    cookieJar.set('auth_id', value);
    document.cookie = `auth_id=${value}`;
  }
}
function installApiFetch(): void {
  const request = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const inputUrl = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const url = new URL(inputUrl, 'http://nara.test');
    fetchPaths.push(url.pathname);

    const headers = new Headers(input instanceof Request ? input.headers : undefined);
    for (const [name, value] of new Headers(init?.headers)) {
      headers.set(name, value);
    }
    const jar = cookieHeader();
    if (jar) headers.set('Cookie', jar);

    const response = await serverApp.request(url.pathname + url.search, {
      method: init?.method,
      headers,
      body: init?.body,
    });
    storeResponseCookies(response);
    const body = await response.text();
    return {
      ok: response.ok,
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
      json: async () => JSON.parse(body),
      text: async () => body,
    } as Response;
  };

  vi.stubGlobal('fetch', (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const response = request(input, init);
    pendingFetches.add(response);
    void response.finally(() => pendingFetches.delete(response));
    return response;
  });
}

async function registerDirect(email: string): Promise<void> {
  const state = await issueCsrf(serverApp);
  adoptCookieString(state.cookie);
  const response = await serverApp.request('/api/auth/register', {
    method: 'POST',
    headers: { ...csrfHeaders(state), 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Existing User', email, password: TEST_PASSWORD }),
  });
  expect(response.status).toBe(201);
  adoptCookieString(mergeResponseCookies(state.cookie, response));
}

async function settle(): Promise<void> {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    if (pendingFetches.size > 0) {
      await Promise.all([...pendingFetches]);
    }
    await Promise.resolve();
    await nextTick();
  }
}
function waitForNavigation(): Promise<void> {
  return new Promise((resolve) => {
    const removeHook = router.afterEach(() => {
      removeHook();
      resolve();
    });
  });
}

async function mountAt(path: string): Promise<void> {
  await router.push(path);
  await router.isReady();
  const mountedApplication = createApp(App).use(router);
  mountedApplication.mount(container);
  application = mountedApplication;
  await nextTick();
}

function setInput(selector: string, value: string): void {
  const input = container.querySelector(selector);
  if (!(input instanceof HTMLInputElement)) throw new Error(`Missing input ${selector}`);
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

function submitForm(): void {
  const form = container.querySelector('form');
  if (!(form instanceof HTMLFormElement)) throw new Error('Missing auth form');
  form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
}

beforeEach(async () => {
  container = document.createElement('div');
  document.body.append(container);
  application = undefined;
  cookieJar = new Map();
  document.cookie = 'auth_id=; expires=Thu, 01 Jan 1970 00:00:00 GMT';
  document.cookie = 'csrf_token=; expires=Thu, 01 Jan 1970 00:00:00 GMT';
  fetchPaths = [];
  pendingFetches = new Set();
  installApiFetch();

  await useAuthSession().logout();
  await router.push('/');
  await router.isReady();
});

afterEach(async () => {
  application?.unmount();
  application = undefined;
  await useAuthSession().logout();
  await router.push('/');
  container.remove();
  vi.unstubAllGlobals();
});

describe('browser authentication lifecycle', () => {
  it('navigates from login to registration and registers without a document reload', async () => {
    await mountAt('/login');
    const documentElement = document.documentElement;
    const registerLink = container.querySelector<HTMLAnchorElement>('a[href="/register"]');
    expect(registerLink).not.toBeNull();
    const registerNavigation = waitForNavigation();
    registerLink?.click();
    await registerNavigation;

    expect(router.currentRoute.value.name).toBe('register');
    expect(container.querySelector('h1')?.textContent).toContain('Create your account');

    const email = `register-${Date.now()}@example.com`;
    setInput('#name', 'Ada Lovelace');
    setInput('#email', email);
    setInput('#password', TEST_PASSWORD);
    setInput('#password-confirmation', TEST_PASSWORD);
    const dashboardNavigation = waitForNavigation();
    submitForm();
    await nextTick();
    const registrationButton = container.querySelector<HTMLButtonElement>('button[type="submit"]');
    expect(registrationButton?.disabled).toBe(true);
    expect(registrationButton?.textContent).toContain('Creating account…');
    await dashboardNavigation;

    expect(router.currentRoute.value.name).toBe('dashboard');
    expect(container.querySelector('h1')?.textContent).toContain('Welcome, Ada Lovelace.');
    expect(document.documentElement).toBe(documentElement);
    expect(useAuthSession().user.value?.email).toBe(email);
    expect(fetchPaths).toContain('/api/auth/register');

    const currentUserResponse = await serverApp.request('/api/auth/me', {
      headers: { Cookie: cookieHeader()! },
    });
    expect(currentUserResponse.status).toBe(200);
  });

  it('renders registration validation errors without sending invalid input', async () => {
    await mountAt('/register');

    setInput('#name', 'A');
    setInput('#email', 'invalid');
    setInput('#password', 'short');
    setInput('#password-confirmation', 'different');
    submitForm();
    await settle();

    expect(router.currentRoute.value.name).toBe('register');
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('Please correct');
    expect(container.textContent).toContain('Name must be at least 2 characters');
    expect(container.textContent).toContain('Invalid email format');
    expect(fetchPaths.filter((path) => path === '/api/auth/register')).toHaveLength(0);
  });

  it('renders a server registration failure', async () => {
    const email = `duplicate-${Date.now()}@example.com`;
    await registerDirect(email);
    await useAuthSession().logout();
    await mountAt('/register');

    setInput('#name', 'Another User');
    setInput('#email', email);
    setInput('#password', TEST_PASSWORD);
    setInput('#password-confirmation', TEST_PASSWORD);
    submitForm();
    await settle();

    expect(router.currentRoute.value.name).toBe('register');
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('Email already in use');
  });

  it('renders login errors and loading state', async () => {
    const email = `login-error-${Date.now()}@example.com`;
    await registerDirect(email);
    await useAuthSession().logout();
    await mountAt('/login');

    setInput('#email', email);
    setInput('#password', 'wrong password');
    submitForm();

    await nextTick();
    const loginErrorButton = container.querySelector<HTMLButtonElement>('button[type="submit"]');
    expect(loginErrorButton?.disabled).toBe(true);
    expect(loginErrorButton?.textContent).toContain('Signing in…');
    await settle();

    expect(router.currentRoute.value.name).toBe('login');
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('Invalid email or password');
    expect(useAuthSession().status.value).toBe('unauthenticated');
  });

  it('bootstraps an existing session once and resolves missing or expired sessions as guests', async () => {
    const email = `bootstrap-${Date.now()}@example.com`;
    await registerDirect(email);
    const session = createAuthSession();

    await Promise.all([session.load(), session.load()]);

    expect(session.status.value).toBe('authenticated');
    expect(session.user.value?.email).toBe(email);
    expect(fetchPaths.filter((path) => path === '/api/auth/me')).toHaveLength(1);

    setSessionCookie(undefined);
    const missingSession = createAuthSession();
    await missingSession.load();
    expect(missingSession.status.value).toBe('unauthenticated');

    setSessionCookie('expired-session');
    const expiredSession = createAuthSession();
    await expiredSession.load();
    expect(expiredSession.status.value).toBe('unauthenticated');
  });

  it('redirects guests to login and returns them to the protected destination after login', async () => {
    const email = `login-${Date.now()}@example.com`;
    await registerDirect(email);
    await useAuthSession().logout();

    await mountAt('/dashboard');
    expect(router.currentRoute.value.name).toBe('login');
    expect(router.currentRoute.value.query.redirect).toBe('/dashboard');

    const documentElement = document.documentElement;
    setInput('#email', email);
    setInput('#password', TEST_PASSWORD);
    const navigation = waitForNavigation();
    submitForm();
    await nextTick();
    const loginButton = container.querySelector<HTMLButtonElement>('button[type="submit"]');
    expect(loginButton?.disabled).toBe(true);
    expect(loginButton?.textContent).toContain('Signing in…');
    await navigation;

    expect(router.currentRoute.value.name).toBe('dashboard');
    expect(container.querySelector('h1')?.textContent).toContain('Welcome, Existing User.');
    expect(useAuthSession().isAuthenticated.value).toBe(true);
    expect(document.documentElement).toBe(documentElement);
  });

  it('logs out through the server and protects the route again', async () => {
    const email = `logout-${Date.now()}@example.com`;
    await registerDirect(email);
    await useAuthSession().refresh();
    await mountAt('/dashboard');

    const logoutButton = container.querySelector('button');
    expect(logoutButton?.textContent).toContain('Sign out');
    const navigation = waitForNavigation();
    logoutButton?.click();
    await navigation;

    expect(router.currentRoute.value.name).toBe('login');
    expect(useAuthSession().status.value).toBe('unauthenticated');
    const currentUserResponse = await serverApp.request('/api/auth/me', {
      headers: { Cookie: cookieHeader() ?? '' },
    });
    expect(currentUserResponse.status).toBe(401);

    await router.push('/dashboard');
    await router.isReady();
    expect(router.currentRoute.value.name).toBe('login');
  });
});
