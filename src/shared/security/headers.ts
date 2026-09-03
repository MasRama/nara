import type { Context, Next } from 'hono';

/**
 * Browser security headers ported from the v2 `securityHeaders` middleware
 * into idiomatic Hono. Headers are applied after downstream handlers run so
 * they also cover deterministic error responses (401/403/404/422/429).
 */
export interface SecurityHeadersOptions {
  isProduction: boolean;
  /** Same-origin Vite dev server origin appended to script/style/connect in dev. */
  viteOrigin?: string;
}

const PERMISSIONS_POLICY =
  'accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()';

function contentSecurityPolicy(isProduction: boolean, viteOrigin: string): string {
  // v2 shipped script-src 'self' 'unsafe-inline' 'unsafe-eval'. v3 drops
  // unsafe-eval (no demonstrated runtime need) and keeps script-src tight:
  // the production Vite build emits external hashed module scripts only.
  // style-src keeps 'unsafe-inline' because Vue applies dynamic styles via
  // style attributes, which style-src governs.
  const scriptSrc = isProduction ? `'self'` : `'self' 'unsafe-inline' ${viteOrigin}`;
  const styleSrc = isProduction
    ? `'self' 'unsafe-inline' https://rsms.me https://fonts.googleapis.com`
    : `'self' 'unsafe-inline' https://rsms.me https://fonts.googleapis.com ${viteOrigin}`;
  const connectSrc = isProduction
    ? `'self' https: wss:`
    : `'self' https: wss: ws: ${viteOrigin}`;
  return [
    `default-src 'self'`,
    `script-src ${scriptSrc}`,
    `style-src ${styleSrc}`,
    `img-src 'self' data: blob: https:`,
    `font-src 'self' data: https:`,
    `connect-src ${connectSrc}`,
    `media-src 'self'`,
    `object-src 'none'`,
    `frame-ancestors 'none'`,
    `form-action 'self'`,
    `base-uri 'self'`,
  ].join('; ');
}

export function securityHeaders(options: SecurityHeadersOptions) {
  const { isProduction, viteOrigin = 'http://localhost:5173' } = options;
  const csp = contentSecurityPolicy(isProduction, viteOrigin);

  return async function securityHeadersMiddleware(context: Context, next: Next): Promise<Response | void> {
    await next();
    context.header('X-Content-Type-Options', 'nosniff');
    context.header('X-Frame-Options', 'DENY');
    context.header('Referrer-Policy', 'strict-origin-when-cross-origin');
    context.header('X-XSS-Protection', '0');
    context.header('Content-Security-Policy', csp);
    context.header('Permissions-Policy', PERMISSIONS_POLICY);
    // HSTS is production-only: emitting it over local HTTP development would
    // be misleading. Conservative max-age matching the prior v2 policy.
    if (isProduction) {
      context.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }
  };
}
