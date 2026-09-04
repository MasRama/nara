import type { Context, Next } from 'hono';

/**
 * Route-owned API request body budgets. Handlers call `context.req.json()`
 * regardless of the declared media type, so enforcement must not depend on
 * attacker-controlled `Content-Type`: an unrelated endpoint never gains the
 * larger avatar upload budget merely by declaring `multipart/form-data`.
 *
 * - Every state-changing `/api/` request is bounded by `jsonMaxBytes`
 *   (default 1 MB) regardless of media type.
 * - Only `POST /api/assets/avatar` receives the narrowly larger
 *   `uploadMaxBytes` request budget (5 MB file + 256 KiB framing allowance).
 *   The Feature-level 5 MB file check stays authoritative; this bound only
 *   rejects before `parseBody()` can materialize an arbitrarily large upload.
 *
 * Bodies are bounded without buffering unbounded input: the declared length
 * is checked first, then at most `maxBytes + 1` are streamed from a cloned
 * request so the original body remains readable downstream.
 */
export interface ApiBodyLimitOptions {
  jsonMaxBytes: number;
  uploadMaxBytes: number;
}

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const AVATAR_UPLOAD_PATH = '/api/assets/avatar';

function isApiRequest(context: Context): boolean {
  return new URL(context.req.url).pathname.startsWith('/api/');
}

/** Only the avatar upload endpoint owns the larger request budget. */
function isAvatarUpload(context: Context): boolean {
  return (
    context.req.method.toUpperCase() === 'POST' &&
    new URL(context.req.url).pathname === AVATAR_UPLOAD_PATH
  );
}

async function exceedsBound(raw: Request, maxBytes: number): Promise<boolean> {
  const rawBody = raw.body;
  if (!rawBody) return false;
  try {
    const clone = raw.clone();
    const reader = clone.body?.getReader();
    if (!reader) {
      // Body exists but cannot be streamed back: fail closed only when the
      // sender actually claims a body. Bodyless requests stay unaffected.
      const declared = Number(raw.headers.get('content-length'));
      return Number.isFinite(declared) && declared > 0;
    }
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
    // An unread body exists but size enforcement cannot inspect it. Fail
    // closed: silently allowing it would permit unbounded parsing.
    // Bodyless requests return before this point, so they are unaffected.
    return true;
  }
}

function declaredExceeds(context: Context, maxBytes: number): boolean {
  const declared = Number(context.req.header('content-length'));
  return Number.isFinite(declared) && declared > maxBytes;
}

export function apiBodyLimit(options: ApiBodyLimitOptions) {
  const { jsonMaxBytes, uploadMaxBytes } = options;

  return async function apiBodyLimitMiddleware(context: Context, next: Next): Promise<Response | void> {
    if (!isApiRequest(context)) return next();
    if (SAFE_METHODS.has(context.req.method.toUpperCase())) return next();
    // Route-owned budget: endpoint policy decides, never Content-Type.
    const maxBytes = isAvatarUpload(context) ? uploadMaxBytes : jsonMaxBytes;

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
