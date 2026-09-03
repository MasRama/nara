import type { Context, Next } from 'hono';

/**
 * Bounded JSON request body handling. Rejects oversized JSON payloads with a
 * deterministic 413 before route handlers parse anything, without buffering
 * unbounded bodies: the declared length is checked first, then at most
 * `maxBytes + 1` are streamed from a cloned request so the original body
 * remains readable downstream. Multipart uploads (avatar) are exempt and keep
 * their own file-size constraints.
 */
export interface BodyLimitOptions {
  maxBytes: number;
}

export function jsonBodyLimit(options: BodyLimitOptions) {
  const { maxBytes } = options;

  return async function jsonBodyLimitMiddleware(context: Context, next: Next): Promise<Response | void> {
    const url = new URL(context.req.url);
    if (!url.pathname.startsWith('/api/')) return next();
    const contentType = context.req.header('content-type') ?? '';
    if (!contentType.includes('application/json')) return next();

    const declared = Number(context.req.header('content-length'));
    if (Number.isFinite(declared) && declared > maxBytes) {
      return payloadTooLarge(context);
    }

    const rawBody = context.req.raw.body;
    if (rawBody) {
      try {
        const clone = context.req.raw.clone();
        const reader = clone.body?.getReader();
        if (reader) {
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
              return payloadTooLarge(context);
            }
          }
        }
      } catch {
        // Body already consumed or unavailable; fall through to the handler,
        // which validates whatever it can parse.
      }
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
