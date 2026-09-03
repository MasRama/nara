import type { Context, Next } from 'hono';

/**
 * Bounded API request body handling. Route handlers call `context.req.json()`
 * regardless of the declared media type, so enforcement cannot depend on an
 * attacker-controlled `Content-Type`. Both limiters bound the API
 * request/body boundary before handlers parse anything, without buffering
 * unbounded bodies: the declared length is checked first, then at most
 * `maxBytes + 1` are streamed from a cloned request so the original body
 * remains readable downstream.
 *
 * - `jsonBodyLimit` covers every state-changing `/api/` request except
 *   `multipart/*` (avatar uploads keep their own file policy plus the
 *   request-level multipart bound below).
 * - `multipartBodyLimit` early-bounds `multipart/*` request bodies before
 *   `parseBody()` materializes an arbitrarily large upload. The
 *   request-level cap is narrowly higher than the 5 MB file limit to allow
 *   multipart framing; the Feature-level file check stays authoritative.
 */
export interface BodyLimitOptions {
  maxBytes: number;
}

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function isApiRequest(context: Context): boolean {
  return new URL(context.req.url).pathname.startsWith('/api/');
}

function isMultipart(context: Context): boolean {
  return (context.req.header('content-type') ?? '').toLowerCase().includes('multipart/');
}

async function exceedsBound(raw: Request, maxBytes: number): Promise<boolean> {
  const rawBody = raw.body;
  if (!rawBody) return false;
  try {
    const clone = raw.clone();
    const reader = clone.body?.getReader();
    if (!reader) return false;
    let seen = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      seen += value.byteLength;
      if (seen > maxBytes) {
        // Abandon the clone; the original body is untouched and this
        // request ends here. releaseLock (not cancel) avoids stalling
        // runtimes where cancelling a tee branch never settles.
        reader.releaseLock();
        return true;
      }
    }
    return false;
  } catch {
    // Body already consumed or unavailable; fall through to the handler,
    // which validates whatever it can parse.
    return false;
  }
}

function declaredExceeds(context: Context, maxBytes: number): boolean {
  const declared = Number(context.req.header('content-length'));
  return Number.isFinite(declared) && declared > maxBytes;
}

export function jsonBodyLimit(options: BodyLimitOptions) {
  const { maxBytes } = options;

  return async function jsonBodyLimitMiddleware(context: Context, next: Next): Promise<Response | void> {
    if (!isApiRequest(context)) return next();
    if (SAFE_METHODS.has(context.req.method.toUpperCase())) return next();
    // Multipart uploads are exempt here; multipartBodyLimit bounds them.
    if (isMultipart(context)) return next();

    if (declaredExceeds(context, maxBytes)) {
      return payloadTooLarge(context);
    }
    if (await exceedsBound(context.req.raw, maxBytes)) {
      return payloadTooLarge(context);
    }
    return next();
  };
}

export function multipartBodyLimit(options: BodyLimitOptions) {
  const { maxBytes } = options;

  return async function multipartBodyLimitMiddleware(
    context: Context,
    next: Next,
  ): Promise<Response | void> {
    if (!isApiRequest(context)) return next();
    if (SAFE_METHODS.has(context.req.method.toUpperCase())) return next();
    if (!isMultipart(context)) return next();

    if (declaredExceeds(context, maxBytes)) {
      return payloadTooLarge(context);
    }
    if (await exceedsBound(context.req.raw, maxBytes)) {
      return payloadTooLarge(context);
    }
    return next();
  };
}

function payloadTooLarge(context: Context): Response {
  return context.json(
    { success: false as const, message: 'Request body too large', code: 'PAYLOAD_TOO_LARGE' },
    413,
  );
}
