/**
 * Request Logger Middleware
 *
 * Logs all HTTP requests with timing, status codes, and relevant metadata.
 */

import type { NaraRequest, NaraResponse, NaraMiddleware } from '@nara-web/core';

/**
 * Request logger configuration options
 */
export interface RequestLoggerOptions {
  /** Skip logging for certain requests */
  skip?: (req: NaraRequest) => boolean;
  /** Headers to include in log (default: user-agent) */
  includeHeaders?: string[];
  /** Include query parameters in log */
  includeQuery?: boolean;
  /** Log level for successful requests (default: 'info') */
  successLevel?: 'trace' | 'debug' | 'info';
  /** Log level for client errors 4xx (default: 'warn') */
  clientErrorLevel?: 'info' | 'warn';
  /** Log level for server errors 5xx (default: 'error') */
  serverErrorLevel?: 'warn' | 'error';
}

/**
 * Default paths to skip logging
 */
const DEFAULT_SKIP_PATHS = [
  '/health',
  '/ready',
  '/favicon.ico',
  '/robots.txt',
];

/**
 * Default static asset extensions to skip
 */
const STATIC_EXTENSIONS = [
  '.js', '.css', '.map', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico',
  '.woff', '.woff2', '.ttf', '.eot', '.webp', '.avif',
];

/**
 * Check if path is a static asset
 */
function isStaticAsset(path: string): boolean {
  return STATIC_EXTENSIONS.some(ext => path.endsWith(ext));
}

/**
 * Create request logger middleware
 */
export function requestLogger(options: RequestLoggerOptions = {}): NaraMiddleware {
  const {
    skip,
    includeHeaders = ['user-agent'],
    includeQuery = false,
    successLevel = 'info',
    clientErrorLevel = 'warn',
    serverErrorLevel = 'error',
  } = options;

  return (req: NaraRequest, res: NaraResponse, next: () => void) => {
    const startTime = process.hrtime.bigint();
    const startTimestamp = Date.now();

    // Check if should skip this request
    const shouldSkip =
      (skip && skip(req)) ||
      DEFAULT_SKIP_PATHS.includes(req.path) ||
      isStaticAsset(req.path);

    if (shouldSkip) {
      return next();
    }

    // Store original end method to intercept response
    const originalJson = res.json.bind(res);
    const originalSend = res.send.bind(res);

    let logged = false;

    const logRequest = (statusCode?: number) => {
      if (logged) return;
      logged = true;

      const endTime = process.hrtime.bigint();
      const durationNs = Number(endTime - startTime);
      const durationMs = Math.round(durationNs / 1_000_000);

      // Get status code from response
      const status = statusCode || res.statusCode || 200;

      // Build log data
      const logData: Record<string, unknown> = {
        method: req.method,
        path: req.path,
        statusCode: status,
        durationMs,
        ip: req.ip,
        timestamp: new Date(startTimestamp).toISOString(),
      };

      // Add user ID if authenticated
      if (req.user?.id) {
        logData.userId = req.user.id;
      }

      // Add selected headers
      if (includeHeaders.length > 0) {
        const headers: Record<string, string> = {};
        for (const header of includeHeaders) {
          const value = req.headers[header.toLowerCase()];
          if (value) {
            headers[header] = Array.isArray(value) ? value[0] : value;
          }
        }
        if (Object.keys(headers).length > 0) {
          logData.headers = headers;
        }
      }

      // Add query parameters
      if (includeQuery && Object.keys(req.query).length > 0) {
        logData.query = req.query;
      }

      // Determine log level based on status code
      let level: string;
      if (status >= 500) {
        level = serverErrorLevel;
      } else if (status >= 400) {
        level = clientErrorLevel;
      } else {
        level = successLevel;
      }

      // Format message
      const message = `${req.method} ${req.path} ${status} ${durationMs}ms`;

      // Log based on level
      if (level === 'error') {
        console.error(`[ERROR] ${message}`, logData);
      } else if (level === 'warn') {
        console.warn(`[WARN] ${message}`, logData);
      } else if (level === 'debug' || level === 'trace') {
        console.debug(`[DEBUG] ${message}`, logData);
      } else {
        console.log(`[INFO] ${message}`, logData);
      }
    };

    // Intercept json() to capture status code
    res.json = (data: unknown) => {
      logRequest();
      return originalJson(data);
    };

    // Intercept send() to capture status code
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    res.send = (data: any) => {
      logRequest();
      return originalSend(data);
    };

    // Also log on response finish (for redirects, etc.)
    res.on('finish', () => {
      logRequest();
    });

    return next();
  };
}

/**
 * Create a verbose request logger for debugging
 */
export function verboseRequestLogger(): NaraMiddleware {
  return requestLogger({
    includeHeaders: ['user-agent', 'referer', 'content-type', 'accept'],
    includeQuery: true,
    successLevel: 'debug',
  });
}

/**
 * Create a minimal request logger (only errors)
 */
export function errorOnlyRequestLogger(): NaraMiddleware {
  return requestLogger({
    skip: (req) => req.method === 'GET', // Skip GET requests
    successLevel: 'trace',
    clientErrorLevel: 'warn',
    serverErrorLevel: 'error',
  });
}

export default requestLogger;
