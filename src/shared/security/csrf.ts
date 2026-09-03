import { randomBytes, timingSafeEqual } from 'node:crypto';
import { getCookie, setCookie } from 'hono/cookie';
import type { Context, Next } from 'hono';
import { SECURITY } from '../config';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function issueToken(): string {
  return randomBytes(SECURITY.CSRF_TOKEN_BYTES).toString('hex');
}

function csrfCookieOptions(isProduction: boolean) {
  return {
    path: '/',
    // Deliberately readable: double-submit requires the browser to echo the
    // token back in a header. The session cookie stays HttpOnly.
    httpOnly: false,
    secure: isProduction,
    sameSite: 'Lax' as const,
    maxAge: SECURITY.CSRF_COOKIE_MAX_AGE_MS / 1000,
  };
}

/**
 * Ensure every API response carries a CSRF cookie when missing, and enforce
 * double-submit comparison on state-changing API requests:
 * `X-CSRF-Token` header must constant-time-match the cookie value.
 */
export function ensureCsrfToken(context: Context, isProduction: boolean): string {
  const existing = getCookie(context, SECURITY.CSRF_COOKIE_NAME);
  if (existing) return existing;
  const token = issueToken();
  setCookie(context, SECURITY.CSRF_COOKIE_NAME, token, csrfCookieOptions(isProduction));
  // The bootstrap handler reads the request cookie, which cannot see the
  // token issued on this same response. Stash it for this request.
  context.set('csrfToken', token);
  return token;
}

export function requestCsrfToken(context: Context): string | undefined {
  const stashed = context.get('csrfToken');
  if (typeof stashed === 'string' && stashed.length > 0) return stashed;
  return getCookie(context, SECURITY.CSRF_COOKIE_NAME);
}
function tokensMatch(submitted: string, expected: string): boolean {
  const a = Buffer.from(submitted);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export interface CsrfOptions {
  isProduction: boolean;
}

export function csrfProtection(options: CsrfOptions) {
  const { isProduction } = options;

  return async function csrfMiddleware(context: Context, next: Next): Promise<Response | void> {
    const url = new URL(context.req.url);
    if (!url.pathname.startsWith('/api/')) return next();

    const token = ensureCsrfToken(context, isProduction);
    if (SAFE_METHODS.has(context.req.method.toUpperCase())) return next();

    const submitted = context.req.header(SECURITY.CSRF_HEADER_NAME);
    if (!submitted || !tokensMatch(submitted, token)) {
      return context.json(
        { success: false as const, message: 'Invalid CSRF token', code: 'CSRF_INVALID' },
        403,
      );
    }
    return next();
  };
}
