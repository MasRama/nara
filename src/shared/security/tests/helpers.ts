import type { Hono } from 'hono';
import { SECURITY } from '../../config';

/**
 * Direct `app.request` CSRF helper for integration tests. Mirrors the real
 * browser: bootstrap a token, then echo cookie + header on mutations.
 */
export interface CsrfState {
  cookie: string;
  token: string;
}

function parseSetCookies(response: Response): string[] {
  const headers = response.headers as Headers & { getSetCookie?: () => string[] };
  if (typeof headers.getSetCookie === 'function') return headers.getSetCookie();
  const single = headers.get('set-cookie');
  return single ? [single] : [];
}

function mergeCookies(existing: string | undefined, response: Response): string {
  const jar = new Map<string, string>();
  for (const part of (existing ?? '').split(';')) {
    const trimmed = part.trim();
    const separator = trimmed.indexOf('=');
    if (separator > 0) jar.set(trimmed.slice(0, separator).trim(), trimmed.slice(separator + 1));
  }
  for (const header of parseSetCookies(response)) {
    const pair = header.split(';', 1)[0] ?? '';
    const separator = pair.indexOf('=');
    if (separator <= 0) continue;
    const name = pair.slice(0, separator).trim();
    const value = pair.slice(separator + 1);
    if (value.length === 0) jar.delete(name);
    else jar.set(name, value);
  }
  return [...jar].map(([name, value]) => `${name}=${value}`).join('; ');
}

export async function issueCsrf(app: Hono, cookie?: string): Promise<CsrfState> {
  const headers: Record<string, string> = {};
  if (cookie) headers.Cookie = cookie;
  const response = await app.request('/api/auth/csrf', { headers });
  if (response.status !== 200) throw new Error(`CSRF bootstrap failed with ${response.status}`);
  const merged = mergeCookies(cookie, response);
  const token = merged
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${SECURITY.CSRF_COOKIE_NAME}=`))
    ?.slice(SECURITY.CSRF_COOKIE_NAME.length + 1);
  if (!token) throw new Error('CSRF bootstrap did not set a token cookie');
  return { cookie: merged, token };
}

export function csrfHeaders(state: CsrfState, extra: Record<string, string> = {}): Record<string, string> {
  return {
    ...extra,
    Cookie: state.cookie,
    [SECURITY.CSRF_HEADER_NAME]: state.token,
  };
}

export function mergeResponseCookies(existing: string | undefined, response: Response): string {
  return mergeCookies(existing, response);
}
