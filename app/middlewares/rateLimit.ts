import { RATE_LIMIT } from "@config";
import Logger from "@services/Logger";
import type { NaraRequest, NaraResponse, NaraMiddleware } from "@core/types";
import { jsonError } from "@core";

interface RateLimitEntry {
  timestamps: number[];
  lastAccess: number;
}

export interface RateLimitOptions {
  maxRequests?: number;
  windowMs?: number;
  keyGenerator?: (req: NaraRequest) => string;
  skip?: (req: NaraRequest) => boolean;
  message?: string;
  headers?: boolean;
  name?: string;
}

const store = new Map<string, RateLimitEntry>();

let cleanupInterval: ReturnType<typeof setInterval> | null = null;

function startCleanup(windowMs: number): void {
  if (cleanupInterval) return;
  
  cleanupInterval = setInterval(() => {
    const now = Date.now();
    const expireTime = now - windowMs * 2;
    
    for (const [key, entry] of store.entries()) {
      if (entry.lastAccess < expireTime) {
        store.delete(key);
      }
    }
  }, 60 * 1000);
  
  cleanupInterval.unref();
}

function getRequestCount(key: string, windowMs: number): number {
  const entry = store.get(key);
  if (!entry) return 0;
  
  const now = Date.now();
  const windowStart = now - windowMs;
  
  const validTimestamps = entry.timestamps.filter(ts => ts > windowStart);
  
  entry.timestamps = validTimestamps;
  entry.lastAccess = now;
  
  return validTimestamps.length;
}

function recordRequest(key: string): void {
  const now = Date.now();
  const entry = store.get(key);
  
  if (entry) {
    entry.timestamps.push(now);
    entry.lastAccess = now;
  } else {
    store.set(key, {
      timestamps: [now],
      lastAccess: now,
    });
  }
}

function getResetTime(key: string, windowMs: number): number {
  const entry = store.get(key);
  if (!entry || entry.timestamps.length === 0) return 0;
  
  const oldestTimestamp = Math.min(...entry.timestamps);
  const resetTime = oldestTimestamp + windowMs;
  return Math.max(0, resetTime - Date.now());
}

export function rateLimit(options: RateLimitOptions = {}): NaraMiddleware {
  const {
    maxRequests = RATE_LIMIT.MAX_REQUESTS,
    windowMs = RATE_LIMIT.WINDOW_MS,
    keyGenerator = (req: NaraRequest) => req.ip || 'unknown',
    skip,
    message = 'Terlalu banyak permintaan, coba lagi nanti',
    headers = true,
    name = 'default',
  } = options;
  
  startCleanup(windowMs);
  
  return (req: NaraRequest, res: NaraResponse, next: () => void) => {
    if (skip && skip(req)) {
      return next();
    }
    
    const key = `${name}:${keyGenerator(req)}`;
    const currentCount = getRequestCount(key, windowMs);
    const remaining = Math.max(0, maxRequests - currentCount - 1);
    const resetMs = getResetTime(key, windowMs);
    
    if (headers) {
      res.setHeader('X-RateLimit-Limit', String(maxRequests));
      res.setHeader('X-RateLimit-Remaining', String(remaining));
      res.setHeader('X-RateLimit-Reset', String(Math.ceil((Date.now() + resetMs) / 1000)));
    }
    
    if (currentCount >= maxRequests) {
      Logger.logSecurity('Rate limit exceeded', {
        key,
        name,
        currentCount,
        maxRequests,
        ip: req.ip,
        path: req.path,
        method: req.method,
      });
      
      if (headers) {
        res.setHeader('Retry-After', String(Math.ceil(resetMs / 1000)));
      }
      
      return jsonError(res, message, 429, 'TOO_MANY_REQUESTS');
    }
    
    recordRequest(key);
    
    return next();
  };
}

export function strictRateLimit(options: RateLimitOptions = {}): NaraMiddleware {
  return rateLimit({
    maxRequests: 10,
    windowMs: 60 * 1000,
    name: 'strict',
    ...options,
  });
}

export function apiRateLimit(options: RateLimitOptions = {}): NaraMiddleware {
  return rateLimit({
    maxRequests: 60,
    windowMs: 60 * 1000,
    name: 'api',
    ...options,
  });
}

export function resetRateLimit(key: string): void {
  store.delete(key);
}

export default rateLimit;
