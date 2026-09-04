import { randomUUID } from 'node:crypto';
import type { Context, Next } from 'hono';
import { clientIp } from '../shared/security';
import { Logger } from '../shared/logging';

/**
 * Request lifecycle observability (V3-044): stable request IDs plus one
 * structured completion event per non-health request. Application/shared
 * infrastructure, not a Feature. Uses Hono context directly; no
 * request-context framework.
 */

export const REQUEST_ID_HEADER = 'X-Request-Id';
const MAX_REQUEST_ID_LENGTH = 128;
// Opaque IDs are allowed, but only from a bounded safe alphabet: no control
// characters, no whitespace, nothing that could inject log/header content.
const SAFE_REQUEST_ID_PATTERN = /^[A-Za-z0-9._~:+-]+$/;

/** Preserve a safe incoming ID, otherwise generate a server UUID. */
export function normalizeRequestId(incoming: string | undefined): string {
  const candidate = (incoming ?? '').trim();
  if (
    candidate.length > 0 &&
    candidate.length <= MAX_REQUEST_ID_LENGTH &&
    SAFE_REQUEST_ID_PATTERN.test(candidate)
  ) {
    return candidate;
  }
  return randomUUID();
}

/** Request ID stashed by {@link requestId} for logging, errors, and handlers. */
export function getRequestId(context: Context): string | undefined {
  const id = context.get('requestId');
  return typeof id === 'string' && id.length > 0 ? id : undefined;
}

export function requestId() {
  return async function requestIdMiddleware(context: Context, next: Next): Promise<Response | void> {
    const id = normalizeRequestId(context.req.header(REQUEST_ID_HEADER));
    context.set('requestId', id);
    // Prepared header: applied to the final response on the normal path.
    // Thrown errors bypass middleware unwinding, so the error handler sets
    // the header again from the stashed ID for 500 correlation.
    context.header(REQUEST_ID_HEADER, id);
    await next();
    context.header(REQUEST_ID_HEADER, id);
  };
}

const QUIET_PATHS = new Set(['/health', '/ready']);

/**
 * One structured completion event per request with method, path, status,
 * duration, and request ID. Health/readiness probes are excluded so they do
 * not spam normal logs; they still receive request IDs. Never logs bodies,
 * passwords, tokens, cookies, or query contents.
 */
export function requestLifecycleLog() {
  return async function requestLifecycleMiddleware(
    context: Context,
    next: Next,
  ): Promise<Response | void> {
    const start = Date.now();
    await next();
    const pathname = new URL(context.req.url).pathname;
    if (QUIET_PATHS.has(pathname)) return;
    Logger.info('HTTP request', {
      requestId: getRequestId(context),
      method: context.req.method,
      path: pathname,
      status: context.res.status,
      durationMs: Date.now() - start,
      ip: clientIp(context),
      userAgent: context.req.header('user-agent'),
    });
  };
}
