/**
 * Browser side of the double-submit CSRF contract (browser-safe: no server
 * imports, only `document.cookie` and `fetch`).
 *
 * Flow: the server issues a readable `csrf_token` cookie on API responses;
 * state-changing requests echo it back in the `X-CSRF-Token` header.
 * Feature clients call `ensureCsrfToken()` before mutations instead of
 * reimplementing this in every page.
 */
export const CSRF_COOKIE_NAME = 'csrf_token';
export const CSRF_HEADER_NAME = 'X-CSRF-Token';
export const CSRF_BOOTSTRAP_PATH = '/api/auth/csrf';

export function readCsrfToken(): string | undefined {
  if (typeof document === 'undefined') return undefined;
  const prefix = `${CSRF_COOKIE_NAME}=`;
  for (const part of document.cookie.split(';')) {
    const trimmed = part.trim();
    if (trimmed.startsWith(prefix) && trimmed.length > prefix.length) {
      return decodeURIComponent(trimmed.slice(prefix.length));
    }
  }
  return undefined;
}

export function csrfHeaders(headers: HeadersInit = {}): Record<string, string> {
  const token = readCsrfToken();
  const base: Record<string, string> =
    headers instanceof Headers
      ? Object.fromEntries(headers.entries())
      : Array.isArray(headers)
        ? Object.fromEntries(headers)
        : { ...(headers as Record<string, string>) };
  if (token) base[CSRF_HEADER_NAME] = token;
  return base;
}
/**
 * Return the current CSRF token, bootstrapping it from the server when the
 * browser has none yet (first visit, expired cookie). Never stored in
 * localStorage: the cookie is the store.
 */
export async function ensureCsrfToken(fetcher: typeof fetch = fetch): Promise<string | undefined> {
  const existing = readCsrfToken();
  if (existing) return existing;
  try {
    const response = await fetcher(CSRF_BOOTSTRAP_PATH, {
      method: 'GET',
      credentials: 'include',
    });
    if (!response.ok) return undefined;
    const payload = (await response.json()) as {
      success?: boolean;
      data?: { csrfToken?: string };
    };
    if (typeof payload.data?.csrfToken === 'string' && payload.data.csrfToken.length > 0) {
      return payload.data.csrfToken;
    }
  } catch {
    // Bootstrap is best-effort; the mutation will surface a CSRF error.
  }
  return readCsrfToken();
}
