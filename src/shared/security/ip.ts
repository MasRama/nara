import { isIP } from 'node:net';
import type { Context } from 'hono';
import { getConnInfo } from '@hono/node-server/conninfo';

/**
 * Effective client IP for rate limiting and login lockout.
 *
 * Default: socket address authoritative, forwarded headers untrusted.
 * Behind the documented nginx/Caddy TLS-terminating reverse proxy, set
 * `TRUST_PROXY=true` (explicit opt-in, never default) with
 * `TRUST_PROXY_HOPS` counting trusted proxy hops (default 1 for a single
 * proxy). The effective IP is then `X-Forwarded-For` counted back from the
 * right by the trusted hop count, so an attacker prepending entries cannot
 * select an arbitrary IP: the proxy appends the real peer address and the
 * trusted suffix is what we honor. Malformed headers fall back to socket.
 *
 * `TRUST_PROXY=true` must only be set when the app is not directly reachable;
 * otherwise a direct client controls the rightmost entry. See SECURITY.md.
 *
 * Tests control the IP deterministically with an `x-test-ip` header, which
 * is honored only when `NODE_ENV=test`.
 */
export function proxyTrust(): { enabled: boolean; hops: number } {
  const enabled = process.env.TRUST_PROXY === 'true';
  const parsed = Number.parseInt(process.env.TRUST_PROXY_HOPS ?? '1', 10);
  const hops = Number.isFinite(parsed) ? Math.min(Math.max(parsed, 1), 10) : 1;
  return { enabled, hops };
}

function socketIp(context: Context): string {
  try {
    const address = getConnInfo(context).remote.address;
    if (typeof address === 'string' && address.length > 0) return address;
  } catch {
    // Test client and non-Node runtimes have no connection info.
  }
  return 'unknown';
}

function forwardedIp(context: Context, hops: number): string | undefined {
  const header = context.req.header('x-forwarded-for');
  if (!header) return undefined;
  const parts = header
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
  if (parts.length === 0 || parts.length > 32) return undefined;
  for (const part of parts) {
    if (isIP(part) === 0) return undefined;
  }
  const index = parts.length - hops;
  if (index < 0 || index >= parts.length) return undefined;
  return parts[index];
}

export function clientIp(context: Context): string {
  if (process.env.NODE_ENV === 'test') {
    const testIp = context.req.header('x-test-ip')?.trim();
    if (testIp) return testIp.slice(0, 64);
  }
  const trust = proxyTrust();
  if (trust.enabled) {
    const forwarded = forwardedIp(context, trust.hops);
    if (forwarded) return forwarded;
  }
  return socketIp(context);
}
