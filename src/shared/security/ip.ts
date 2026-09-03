import type { Context } from 'hono';
import { getConnInfo } from '@hono/node-server/conninfo';

/**
 * Effective client IP for rate limiting and login lockout.
 *
 * Uses the Node socket address via Hono conninfo. Never trusts
 * `X-Forwarded-For` from the public internet: v3 has no proxy-trust
 * configuration, so forwarded headers are ignored entirely.
 *
 * Tests control the IP deterministically with an `x-test-ip` header, which
 * is honored only when `NODE_ENV=test`.
 */
export function clientIp(context: Context): string {
  if (process.env.NODE_ENV === 'test') {
    const testIp = context.req.header('x-test-ip')?.trim();
    if (testIp) return testIp.slice(0, 64);
  }
  try {
    const address = getConnInfo(context).remote.address;
    if (typeof address === 'string' && address.length > 0) return address;
  } catch {
    // Test client and non-Node runtimes have no connection info.
  }
  return 'unknown';
}
