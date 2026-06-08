import Logger from "@services/Logger";
import type { NaraRequest, NaraResponse, NaraMiddleware } from "@core/types";

export interface RequestLoggerOptions {
  skip?: (req: NaraRequest) => boolean;
  includeHeaders?: string[];
  includeQuery?: boolean;
  includeBody?: boolean;
  successLevel?: 'trace' | 'debug' | 'info';
  clientErrorLevel?: 'info' | 'warn';
  serverErrorLevel?: 'warn' | 'error';
}

const DEFAULT_SKIP_PATHS = [
  '/health',
  '/ready',
  '/favicon.ico',
  '/robots.txt',
];

const STATIC_EXTENSIONS = [
  '.js', '.css', '.map', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico',
  '.woff', '.woff2', '.ttf', '.eot', '.webp', '.avif',
];

function isStaticAsset(path: string): boolean {
  return STATIC_EXTENSIONS.some(ext => path.endsWith(ext));
}

export function requestLogger(options: RequestLoggerOptions = {}): NaraMiddleware {
  const {
    skip,
    includeHeaders = ['user-agent'],
    includeQuery = false,
    includeBody = false,
    successLevel = 'info',
    clientErrorLevel = 'warn',
    serverErrorLevel = 'error',
  } = options;
  
  return (req: NaraRequest, res: NaraResponse, next: () => void) => {
    const startTime = process.hrtime.bigint();
    const startTimestamp = Date.now();
    
    const shouldSkip = 
      (skip && skip(req)) ||
      DEFAULT_SKIP_PATHS.includes(req.path) ||
      isStaticAsset(req.path);
    
    if (shouldSkip) {
      return next();
    }
    
    const originalJson = res.json.bind(res);
    const originalSend = res.send.bind(res);
    const originalRedirect = res.redirect.bind(res);

    let logged = false;
    
    const logRequest = (statusCode?: number) => {
      if (logged) return;
      logged = true;
      
      const endTime = process.hrtime.bigint();
      const durationNs = Number(endTime - startTime);
      const durationMs = Math.round(durationNs / 1_000_000);
      
      const status = statusCode || res.statusCode || 200;
      
      const logData: Record<string, unknown> = {
        method: req.method,
        path: req.path,
        statusCode: status,
        durationMs,
        ip: req.ip,
        timestamp: new Date(startTimestamp).toISOString(),
      };

      if (req.requestId) {
        logData.requestId = req.requestId;
      }

      if (req.user?.id) {
        logData.userId = req.user.id;
      }
      
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
      
      if (includeQuery && Object.keys(req.query).length > 0) {
        logData.query = req.query;
      }
      
      let level: 'trace' | 'debug' | 'info' | 'warn' | 'error';
      if (status >= 500) {
        level = serverErrorLevel;
      } else if (status >= 400) {
        level = clientErrorLevel;
      } else {
        level = successLevel;
      }
      
      const message = `${req.method} ${req.path} ${status} ${durationMs}ms`;
      
      switch (level) {
        case 'trace':
          Logger.trace(message, logData);
          break;
        case 'debug':
          Logger.debug(message, logData);
          break;
        case 'info':
          Logger.info(message, logData);
          break;
        case 'warn':
          Logger.warn(message, logData);
          break;
        case 'error':
          Logger.error(message, logData);
          break;
      }
    };
    
    res.json = (data: unknown) => {
      logRequest();
      return originalJson(data);
    };
    
    res.send = (data: unknown) => {
      logRequest();
      return originalSend(data as Parameters<typeof originalSend>[0]);
    };

    res.redirect = ((...args: any[]) => {
      logRequest(typeof args[0] === 'number' ? args[0] : 302);
      return originalRedirect.apply(res, args as any);
    }) as typeof res.redirect;

    return next();
  };
}

export function verboseRequestLogger(): NaraMiddleware {
  return requestLogger({
    includeHeaders: ['user-agent', 'referer', 'content-type', 'accept'],
    includeQuery: true,
    successLevel: 'debug',
  });
}

export function errorOnlyRequestLogger(): NaraMiddleware {
  return requestLogger({
    skip: (req) => req.method === 'GET',
    successLevel: 'trace',
    clientErrorLevel: 'warn',
    serverErrorLevel: 'error',
  });
}

export default requestLogger;
