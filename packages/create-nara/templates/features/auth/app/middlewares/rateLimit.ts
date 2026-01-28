/**
 * Rate Limit Middleware
 *
 * In-memory rate limiting middleware using sliding window algorithm.
 * Tracks requests per key (IP, user, or custom) and returns 429 when limit exceeded.
 */

import type { NaraRequest, NaraResponse, NaraMiddleware } from '@nara-web/core';
import { jsonError } from '@nara-web/core';

/**
 * Rate limit entry for tracking requests
 */
interface RateLimitEntry {
  /** Request timestamps within the window */
  timestamps: number[];
  /** When this entry was last accessed */
  lastAccess: number;
}

/**
 * Rate limit configuration options
 */
export interface RateLimitOptions {
  /** Maximum number of requests allowed within the window */
  maxRequests?: number;
  /** Time window in milliseconds */
  windowMs?: number;
  /** Function to generate the rate limit key (default: IP address) */
  keyGenerator?: (req: NaraRequest) => string;
  /** Function to skip rate limiting for certain requests */
  skip?: (req: NaraRequest) => boolean;
  /** Custom message when rate limit is exceeded */
  message?: string;
  /** Whether to include rate limit headers in response */
  headers?: boolean;
  /** Name for this rate limiter (for logging) */
  name?: string;
}

/**
 * In-memory store for rate limit data
 */
const store = new Map<string, RateLimitEntry>();

/**
 * Cleanup interval ID for automatic garbage collection
 */
let cleanupInterval: ReturnType<typeof setInterval> | null = null;

/**
 * Start automatic cleanup of expired entries
 */
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
  }, 60 * 1000); // Run every minute

  // Don't prevent process exit
  cleanupInterval.unref();
}

/**
 * Get current request count within the window
 */
function getRequestCount(key: string, windowMs: number): number {
  const entry = store.get(key);
  if (!entry) return 0;

  const now = Date.now();
  const windowStart = now - windowMs;

  // Filter timestamps within the window
  const validTimestamps = entry.timestamps.filter(ts => ts > windowStart);

  // Update entry with filtered timestamps
  entry.timestamps = validTimestamps;
  entry.lastAccess = now;

  return validTimestamps.length;
}

/**
 * Record a new request
 */
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

/**
 * Calculate time until rate limit resets
 */
function getResetTime(key: string, windowMs: number): number {
  const entry = store.get(key);
  if (!entry || entry.timestamps.length === 0) return 0;

  const oldestTimestamp = Math.min(...entry.timestamps);
  const resetTime = oldestTimestamp + windowMs;
  return Math.max(0, resetTime - Date.now());
}

/**
 * Create rate limit middleware
 */
export function rateLimit(options: RateLimitOptions = {}): NaraMiddleware {
  const {
    maxRequests = 100,
    windowMs = 15 * 60 * 1000, // 15 minutes
    keyGenerator = (req: NaraRequest) => req.ip || 'unknown',
    skip,
    message = 'Too many requests, please try again later',
    headers = true,
    name = 'default',
  } = options;

  // Start cleanup process
  startCleanup(windowMs);

  return (req: NaraRequest, res: NaraResponse, next: () => void) => {
    // Check if this request should be skipped
    if (skip && skip(req)) {
      return next();
    }

    const key = `${name}:${keyGenerator(req)}`;
    const currentCount = getRequestCount(key, windowMs);
    const remaining = Math.max(0, maxRequests - currentCount - 1);
    const resetMs = getResetTime(key, windowMs);

    // Set rate limit headers
    if (headers) {
      res.setHeader('X-RateLimit-Limit', String(maxRequests));
      res.setHeader('X-RateLimit-Remaining', String(remaining));
      res.setHeader('X-RateLimit-Reset', String(Math.ceil((Date.now() + resetMs) / 1000)));
    }

    // Check if limit exceeded
    if (currentCount >= maxRequests) {
      console.warn('[RateLimit] Exceeded', {
        key,
        name,
        currentCount,
        maxRequests,
        ip: req.ip,
        path: req.path,
      });

      if (headers) {
        res.setHeader('Retry-After', String(Math.ceil(resetMs / 1000)));
      }

      return jsonError(res, message, 429, 'TOO_MANY_REQUESTS');
    }

    // Record this request
    recordRequest(key);

    return next();
  };
}

/**
 * Create a strict rate limiter for sensitive endpoints
 */
export function strictRateLimit(options: RateLimitOptions = {}): NaraMiddleware {
  return rateLimit({
    maxRequests: 10,
    windowMs: 60 * 1000, // 1 minute
    name: 'strict',
    ...options,
  });
}

/**
 * Create an API rate limiter
 */
export function apiRateLimit(options: RateLimitOptions = {}): NaraMiddleware {
  return rateLimit({
    maxRequests: 60,
    windowMs: 60 * 1000, // 60 requests per minute
    name: 'api',
    ...options,
  });
}

/**
 * Reset rate limit for a specific key
 */
export function resetRateLimit(key: string): void {
  store.delete(key);
}

/**
 * Get current store size (for monitoring)
 */
export function getRateLimitStoreSize(): number {
  return store.size;
}

export default rateLimit;
