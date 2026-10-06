import type { Context, Next } from 'hono';

// Apply after downstream handlers so deterministic error responses receive
// the same browser security headers as successful responses.
export interface SecurityHeadersOptions {
  isProduction: boolean;
}

const PERMISSIONS_POLICY =
  'accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()';

function contentSecurityPolicy(isProduction: boolean): string {
  // Production Vite emits external module scripts, so script-src can stay
  // strict. Vue still applies dynamic style attributes, so style-src keeps
  // 'unsafe-inline'.
  const scriptSrc = isProduction ? `'self'` : `'self' 'unsafe-inline'`;
  const styleSrc = isProduction
    ? `'self' 'unsafe-inline' https://rsms.me https://fonts.googleapis.com`
    : `'self' 'unsafe-inline' https://rsms.me https://fonts.googleapis.com`;
  const connectSrc = isProduction
    ? `'self' https: wss:`
    : `'self' https: wss: ws:`;
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
  const { isProduction } = options;
  const csp = contentSecurityPolicy(isProduction);

  return async function securityHeadersMiddleware(context: Context, next: Next): Promise<Response | void> {
    await next();
    context.header('X-Content-Type-Options', 'nosniff');
    context.header('X-Frame-Options', 'DENY');
    context.header('Referrer-Policy', 'strict-origin-when-cross-origin');
    context.header('X-XSS-Protection', '0');
    context.header('Content-Security-Policy', csp);
    context.header('Permissions-Policy', PERMISSIONS_POLICY);
    // HSTS is production-only; emitting it over local HTTP is misleading.
    if (isProduction) {
      context.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }
  };
}
