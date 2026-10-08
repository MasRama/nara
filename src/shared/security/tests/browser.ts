import { randomUUID } from 'node:crypto';
import type { Hono } from 'hono';
import { vi } from 'vitest';

/**
 * A browser stand-in for contract tests: Feature web clients run unchanged
 * against the real app through a stubbed global `fetch`. Cookies persist in a
 * jar that honors `Path` and `HttpOnly` the way a browser does, so only
 * script-readable cookies appear in `document.cookie`.
 *
 * Call `vi.unstubAllGlobals()` after each test to remove the stubs.
 */
interface StoredCookie {
  value: string;
  path: string;
  httpOnly: boolean;
}

const ORIGIN = 'http://localhost';

function setCookieHeaders(response: Response): string[] {
  const headers = response.headers as Headers & { getSetCookie?: () => string[] };
  if (typeof headers.getSetCookie === 'function') return headers.getSetCookie();
  const single = headers.get('set-cookie');
  return single ? [single] : [];
}

export interface TestAccount {
  id: string;
  email: string;
  password: string;
}

export interface TestBrowser {
  /** Every cookie the jar holds, HttpOnly included, as a request header value. */
  cookieHeader(): string;
  /** Registers through the real Auth endpoints, leaving this browser signed in. */
  signUp(name?: string): Promise<TestAccount>;
}

export function installBrowser(app: Hono): TestBrowser {
  const jar = new Map<string, StoredCookie>();

  const store = (response: Response) => {
    for (const header of setCookieHeaders(response)) {
      const [pair = '', ...attributes] = header.split(';').map((part) => part.trim());
      const separator = pair.indexOf('=');
      if (separator <= 0) continue;
      const name = pair.slice(0, separator);
      const value = pair.slice(separator + 1);
      const attribute = (key: string) =>
        attributes.find((part) => part.toLowerCase().startsWith(`${key}=`))?.slice(key.length + 1);
      if (value === '' || attribute('max-age') === '0') {
        jar.delete(name);
        continue;
      }
      jar.set(name, {
        value,
        path: attribute('path') ?? '/',
        httpOnly: attributes.some((part) => part.toLowerCase() === 'httponly'),
      });
    }
  };

  const cookiesFor = (pathname: string, includeHttpOnly: boolean) =>
    [...jar]
      .filter(([, cookie]) => (includeHttpOnly || !cookie.httpOnly) && pathname.startsWith(cookie.path))
      .map(([name, cookie]) => `${name}=${cookie.value}`)
      .join('; ');

  const browserFetch = async (input: string | URL | Request, init: RequestInit = {}): Promise<Response> => {
    const url = new URL(input instanceof Request ? input.url : String(input), ORIGIN);
    const headers = new Headers(input instanceof Request ? input.headers : init.headers);
    const cookie = cookiesFor(url.pathname, true);
    if (cookie) headers.set('Cookie', cookie);
    const response = await app.request(url.pathname + url.search, {
      method: init.method ?? (input instanceof Request ? input.method : 'GET'),
      headers,
      body: init.body ?? (input instanceof Request ? input.body : undefined),
    });
    store(response);
    return response;
  };

  vi.stubGlobal('fetch', browserFetch);
  vi.stubGlobal('document', {
    get cookie() {
      return cookiesFor('/', false);
    },
  });

  return {
    cookieHeader: () => cookiesFor('/', true),
    async signUp(name = 'Contract Account') {
      await browserFetch('/api/auth/csrf');
      const token = /csrf_token=([^;]+)/.exec(cookiesFor('/', false))?.[1] ?? '';
      const account = { email: `${randomUUID()}@example.com`, password: 'correct horse battery staple' };
      const response = await browserFetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token },
        body: JSON.stringify({ name, ...account }),
      });
      if (response.status !== 201) throw new Error(`Sign-up failed with ${response.status}`);
      const payload = (await response.json()) as { data: { user: { id: string } } };
      return { id: payload.data.user.id, ...account };
    },
  };
}
