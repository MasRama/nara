import type { Context, Next } from 'hono';
import { clientIp } from './ip';

/**
 * Bounded in-memory sliding-window rate limiter for the single-host v3
 * architecture. No Redis, no distributed state, no per-key intervals.
 *
 * Boundedness is explicit: stale buckets are swept lazily each window, and
 * key cardinality has a hard ceiling (`maxKeys`, default 10_000). When the
 * ceiling is reached the oldest bucket is evicted before a new key is
 * admitted, so memory cannot grow without bound even if an attacker rotates
 * identifiers. Eviction only forgives an old bucket; it never invents budget.
 */
export interface RateLimitOptions {
  maxRequests: number;
  windowMs: number;
  /** Bucket namespace so independent limiters never share state. */
  name: string;
  /** Request identity. Defaults to effective client IP. */
  keyGenerator?: (context: Context) => string;
  /** Requests that must not consume budget (health probes, static assets). */
  skip?: (context: Context) => boolean;
  /** Overrideable clock for deterministic tests. */
  now?: () => number;
  /** Hard ceiling on distinct keys; oldest evicted first. Defaults to 10_000. */
  maxKeys?: number;
}
export interface RateLimiter {
  middleware: (context: Context, next: Next) => Promise<Response | void>;
  reset: () => void;
}
export function createRateLimiter(options: RateLimitOptions): RateLimiter {
  const { maxRequests, windowMs, name, skip } = options;
  const keyGenerator = options.keyGenerator ?? ((context: Context) => clientIp(context));
  const now = options.now ?? Date.now;
  const maxKeys = options.maxKeys ?? 10_000;
  const buckets = new Map<string, number[]>();
  let lastSweep = now();

  function sweep(currentTime: number): void {
    if (currentTime - lastSweep < windowMs) return;
    lastSweep = currentTime;
    const cutoff = currentTime - windowMs;
    for (const [key, timestamps] of buckets) {
      while (timestamps.length > 0 && timestamps[0]! <= cutoff) timestamps.shift();
      if (timestamps.length === 0) buckets.delete(key);
    }
  }

  function admit(key: string): number[] {
    const existing = buckets.get(key);
    if (existing) return existing;
    // Hard ceiling: evict oldest first-inserted keys before admitting a new
    // one, so cardinality never exceeds maxKeys even under identifier rotation.
    while (buckets.size >= maxKeys) {
      const oldest = buckets.keys().next().value;
      if (oldest === undefined) break;
      buckets.delete(oldest);
    }
    const created: number[] = [];
    buckets.set(key, created);
    return created;
  }

  function rateLimited(context: Context, resetMs: number): Response {
    if (resetMs > 0) context.header('Retry-After', String(Math.ceil(resetMs / 1000)));
    return context.json(
      {
        success: false as const,
        message: 'Too many requests, please try again later',
        code: 'RATE_LIMITED',
      },
      429,
    );
  }

  return {
    middleware: async function rateLimitMiddleware(context: Context, next: Next): Promise<Response | void> {
      if (skip?.(context)) return next();
      const currentTime = now();
      sweep(currentTime);
      const key = `${name}:${keyGenerator(context)}`;
      const cutoff = currentTime - windowMs;
      const timestamps = admit(key);
      while (timestamps.length > 0 && timestamps[0]! <= cutoff) timestamps.shift();

      if (timestamps.length >= maxRequests) {
        const oldest = timestamps[0] ?? currentTime;
        const resetMs = Math.max(0, oldest + windowMs - currentTime);
        context.header('X-RateLimit-Limit', String(maxRequests));
        context.header('X-RateLimit-Remaining', '0');
        context.header('X-RateLimit-Reset', String(Math.ceil((currentTime + resetMs) / 1000)));
        return rateLimited(context, resetMs);
      }

      timestamps.push(currentTime);
      const oldest = timestamps[0] ?? currentTime;
      const resetMs = Math.max(0, oldest + windowMs - currentTime);
      context.header('X-RateLimit-Limit', String(maxRequests));
      context.header('X-RateLimit-Remaining', String(Math.max(0, maxRequests - timestamps.length)));
      context.header('X-RateLimit-Reset', String(Math.ceil((currentTime + resetMs) / 1000)));
      return next();
    },
    reset: () => {
      buckets.clear();
      lastSweep = now();
    },
  };
}
