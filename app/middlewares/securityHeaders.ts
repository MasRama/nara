import type { NaraRequest, NaraResponse, NaraMiddleware } from "@core/types";

export interface CSPDirectives {
  defaultSrc?: string[];
  scriptSrc?: string[];
  styleSrc?: string[];
  imgSrc?: string[];
  fontSrc?: string[];
  connectSrc?: string[];
  mediaSrc?: string[];
  objectSrc?: string[];
  frameSrc?: string[];
  frameAncestors?: string[];
  formAction?: string[];
  baseUri?: string[];
  upgradeInsecureRequests?: boolean;
}

export interface SecurityHeadersOptions {
  hsts?: boolean;
  frameOptions?: 'DENY' | 'SAMEORIGIN' | false;
  contentTypeOptions?: 'nosniff' | false;
  referrerPolicy?: string | false;
  xssProtection?: string | false;
  csp?: boolean | { directives?: CSPDirectives; reportOnly?: boolean; reportUri?: string };
  permissionsPolicy?: Record<string, string[]> | false;
}

const DEFAULT_CSP_DIRECTIVES: CSPDirectives = {
  defaultSrc: ["'self'"],
  scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
  styleSrc: ["'self'", "'unsafe-inline'", 'https://rsms.me', 'https://fonts.googleapis.com'],
  imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
  fontSrc: ["'self'", 'data:', 'https:'],
  connectSrc: ["'self'", 'https:', 'wss:', 'ws:'], // ws: for Vite HMR in dev
  mediaSrc: ["'self'"],
  objectSrc: ["'none'"],
  frameAncestors: ["'none'"],
  formAction: ["'self'"],
  baseUri: ["'self'"],
};

const DEFAULT_PERMISSIONS_POLICY: Record<string, string[]> = {
  'accelerometer': [],
  'camera': [],
  'geolocation': [],
  'gyroscope': [],
  'magnetometer': [],
  'microphone': [],
  'payment': [],
  'usb': [],
};

function buildCSPHeader(directives: CSPDirectives): string {
  const parts: string[] = [];

  if (directives.defaultSrc) parts.push(`default-src ${directives.defaultSrc.join(' ')}`);
  if (directives.scriptSrc) parts.push(`script-src ${directives.scriptSrc.join(' ')}`);
  if (directives.styleSrc) parts.push(`style-src ${directives.styleSrc.join(' ')}`);
  if (directives.imgSrc) parts.push(`img-src ${directives.imgSrc.join(' ')}`);
  if (directives.fontSrc) parts.push(`font-src ${directives.fontSrc.join(' ')}`);
  if (directives.connectSrc) parts.push(`connect-src ${directives.connectSrc.join(' ')}`);
  if (directives.mediaSrc) parts.push(`media-src ${directives.mediaSrc.join(' ')}`);
  if (directives.objectSrc) parts.push(`object-src ${directives.objectSrc.join(' ')}`);
  if (directives.frameSrc) parts.push(`frame-src ${directives.frameSrc.join(' ')}`);
  if (directives.frameAncestors) parts.push(`frame-ancestors ${directives.frameAncestors.join(' ')}`);
  if (directives.formAction) parts.push(`form-action ${directives.formAction.join(' ')}`);
  if (directives.baseUri) parts.push(`base-uri ${directives.baseUri.join(' ')}`);
  if (directives.upgradeInsecureRequests) parts.push('upgrade-insecure-requests');

  return parts.join('; ');
}

function buildPermissionsPolicy(policy: Record<string, string[]>): string {
  return Object.entries(policy)
    .map(([feature, allowlist]) => {
      if (allowlist.length === 0) {
        return `${feature}=()`;
      }
      return `${feature}=(${allowlist.join(' ')})`;
    })
    .join(', ');
}

export function securityHeaders(options: SecurityHeadersOptions = {}): NaraMiddleware {
  const isProduction = process.env.NODE_ENV === 'production';

  const hstsEnabled = options.hsts !== false && isProduction;
  const hstsValue = hstsEnabled ? 'max-age=31536000; includeSubDomains' : null;

  const cspCustom = typeof options.csp === 'object' ? options.csp : null;
  const cspEnabled = cspCustom ? true : options.csp !== false;
  const cspDirectives = { ...DEFAULT_CSP_DIRECTIVES, ...cspCustom?.directives };

  // Dev: Vite serves assets from its own origin (VITE_PORT) — allow it explicitly
  if (!isProduction) {
    const viteOrigin = `http://localhost:${process.env.VITE_PORT || 5173}`;
    cspDirectives.scriptSrc = [...(cspDirectives.scriptSrc ?? []), viteOrigin];
    cspDirectives.styleSrc = [...(cspDirectives.styleSrc ?? []), viteOrigin];
    cspDirectives.connectSrc = [...(cspDirectives.connectSrc ?? []), viteOrigin];
  }

  const cspReportOnly = cspCustom?.reportOnly === true;
  const cspReportUri = cspCustom?.reportUri;

  const permissionsPolicy = options.permissionsPolicy !== false
    ? { ...DEFAULT_PERMISSIONS_POLICY, ...(typeof options.permissionsPolicy === 'object' ? options.permissionsPolicy : {}) }
    : null;

  const cspValue = cspEnabled ? buildCSPHeader(cspDirectives) : null;
  const permissionsPolicyValue = permissionsPolicy ? buildPermissionsPolicy(permissionsPolicy) : null;

  return (_req: NaraRequest, res: NaraResponse, next: () => void) => {
    if (hstsValue) {
      res.setHeader('Strict-Transport-Security', hstsValue);
    }

    if (options.frameOptions !== false) {
      res.setHeader('X-Frame-Options', options.frameOptions || 'DENY');
    }

    if (options.contentTypeOptions !== false) {
      res.setHeader('X-Content-Type-Options', options.contentTypeOptions || 'nosniff');
    }

    if (options.referrerPolicy !== false) {
      res.setHeader('Referrer-Policy', options.referrerPolicy || 'strict-origin-when-cross-origin');
    }

    if (options.xssProtection !== false) {
      res.setHeader('X-XSS-Protection', options.xssProtection || '0');
    }

    if (cspValue) {
      const headerName = cspReportOnly
        ? 'Content-Security-Policy-Report-Only'
        : 'Content-Security-Policy';

      const value = cspReportUri ? `${cspValue}; report-uri ${cspReportUri}` : cspValue;
      res.setHeader(headerName, value);
    }

    if (permissionsPolicyValue) {
      res.setHeader('Permissions-Policy', permissionsPolicyValue);
    }

    return next();
  };
}

export default securityHeaders;
