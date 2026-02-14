/**
 * Request ID Middleware
 *
 * Generates or propagates a unique request ID for distributed tracing.
 * Supports upstream proxy/load balancer compatibility via X-Request-ID header.
 *
 * Features:
 * - Generates UUID v4 for each request using crypto.randomUUID()
 * - Checks for incoming X-Request-ID header first (for upstream compatibility)
 * - Attaches requestId to request object for use in controllers
 * - Sets X-Request-ID response header for downstream tracing
 * - Lightweight and designed to run early in the middleware chain
 *
 * @example
 * // Basic usage (early in middleware chain)
 * app.use(requestId());
 *
 * // In controllers
 * class UserController {
 *   async show(req: NaraRequest, res: NaraResponse) {
 *     Logger.info('Fetching user', { requestId: req.requestId });
 *     // ...
 *   }
 * }
 *
 * // Using child logger with request context
 * const reqLogger = Logger.child({ requestId: req.requestId });
 * reqLogger.info('Processing request');
 */

import { randomUUID } from "crypto";
import type { NaraRequest, NaraResponse, NaraMiddleware } from "@core/types";

/**
 * Request ID header name
 */
const REQUEST_ID_HEADER = "x-request-id";

/**
 * Create request ID middleware
 *
 * @returns Middleware function that assigns requestId to req and response header
 */
export function requestId(): NaraMiddleware {
  return (req: NaraRequest, res: NaraResponse, next: () => void) => {
    // Check for incoming request ID from upstream (proxy/load balancer)
    const incomingId = req.headers[REQUEST_ID_HEADER] as string | undefined;

    // Use incoming ID or generate new UUID
    const id = incomingId || randomUUID();

    // Attach to request object for use in controllers
    req.requestId = id;

    // Set response header for downstream tracing
    res.header(REQUEST_ID_HEADER, id);

    return next();
  };
}

/**
 * Create request ID middleware with custom options
 *
 * @param options - Configuration options
 * @returns Middleware function
 */
export interface RequestIdOptions {
  /** Header name to use (default: 'x-request-id') */
  headerName?: string;
  /** Whether to trust incoming request ID from upstream (default: true) */
  trustUpstream?: boolean;
  /** Custom ID generator function (default: crypto.randomUUID) */
  generator?: () => string;
}

/**
 * Create configurable request ID middleware
 *
 * @param options - Configuration options
 * @returns Middleware function
 *
 * @example
 * // Custom header name
 * app.use(requestIdWithOptions({ headerName: 'x-trace-id' }));
 *
 * // Don't trust upstream (always generate new)
 * app.use(requestIdWithOptions({ trustUpstream: false }));
 *
 * // Custom generator
 * app.use(requestIdWithOptions({
 *   generator: () => `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
 * }));
 */
export function requestIdWithOptions(options: RequestIdOptions = {}): NaraMiddleware {
  const {
    headerName = REQUEST_ID_HEADER,
    trustUpstream = true,
    generator = randomUUID,
  } = options;

  return (req: NaraRequest, res: NaraResponse, next: () => void) => {
    // Check for incoming request ID if trusting upstream
    const incomingId = trustUpstream
      ? (req.headers[headerName.toLowerCase()] as string | undefined)
      : undefined;

    // Use incoming ID or generate new
    const id = incomingId || generator();

    // Attach to request object
    req.requestId = id;

    // Set response header
    res.header(headerName, id);

    return next();
  };
}

export default requestId;
