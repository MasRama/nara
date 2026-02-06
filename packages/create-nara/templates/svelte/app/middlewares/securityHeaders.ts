/**
 * Security Headers Middleware
 *
 * Adds essential security headers to all responses to protect against
 * common web vulnerabilities like XSS, clickjacking, and MIME sniffing.
 */

import type { NaraRequest, NaraResponse, NaraMiddleware } from '@nara-web/core';

/**
 * HSTS (HTTP Strict Transport Security) options
 */
export interface HSTSOptions {
  /** Max age in seconds (default: 1 year) */
  maxAge?: number;
  /** Include subdomains (default: true) */
  includeSubDomains?: boolean;
  /** Add to browser preload list (default: false) */
  preload?: boolean;
  /** Enable HSTS (default: true in production) */
  enabled?: boolean;
}

/**
 * Content Security Policy directives
 */
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

/**
 * CSP options
 */
export interface CSPOptions {
  /** CSP directives */
  directives?: CSPDirectives;
  /** Report-only mode (doesn't block, just reports) */
  reportOnly?: boolean;
  /** Report URI for violations */
  reportUri?: string;
  /** Enable CSP (default: false - opt-in) */
  enabled?: boolean;
}

/**
 * Security headers configuration options
 */
export interface SecurityHeadersOptions {
  /** HSTS configuration */
  hsts?: HSTSOptions | boolean;
  /** X-Frame-Options value (default: 'DENY') */
  frameOptions?: 'DENY' | 'SAMEORIGIN' | false;
  /** X-Content-Type-Options (default: 'nosniff') */
  contentTypeOptions?: 'nosniff' | false;
  /** Referrer-Policy value */
  referrerPolicy?: string | false;
  /** X-XSS-Protection (legacy, default: '0') */
  xssProtection?: string | false;
  /** Content-Security-Policy configuration */
  csp?: CSPOptions | false;
  /** Permissions-Policy configuration */
  permissionsPolicy?: Record<string, string[]> | false;
}

/**
 * Default CSP directives (permissive but secure)
 */
const DEFAULT_CSP_DIRECTIVES: CSPDirectives = {
  defaultSrc: ["'self'"],
  scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"], // Relaxed for Vite/Svelte
  styleSrc: ["'self'", "'unsafe-inline'"], // Relaxed for inline styles
  imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
  fontSrc: ["'self'", 'data:', 'https:'],
  connectSrc: ["'self'", 'https:', 'wss:'], // Allow WebSocket for HMR
  mediaSrc: ["'self'"],
  objectSrc: ["'none'"],
  frameAncestors: ["'none'"],
  formAction: ["'self'"],
  baseUri: ["'self'"],
};

/**
 * Default Permissions-Policy
 */
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

/**
 * Build CSP header value from directives
 */
function buildCSPHeader(directives: CSPDirectives): string {
  const parts: string[] = [];

  if (directives.defaultSrc) {
    parts.push(`default-src ${directives.defaultSrc.join(' ')}`);
  }
  if (directives.scriptSrc) {
    parts.push(`script-src ${directives.scriptSrc.join(' ')}`);
  }
  if (directives.styleSrc) {
    parts.push(`style-src ${directives.styleSrc.join(' ')}`);
  }
  if (directives.imgSrc) {
    parts.push(`img-src ${directives.imgSrc.join(' ')}`);
  }
  if (directives.fontSrc) {
    parts.push(`font-src ${directives.fontSrc.join(' ')}`);
  }
  if (directives.connectSrc) {
    parts.push(`connect-src ${directives.connectSrc.join(' ')}`);
  }
  if (directives.mediaSrc) {
    parts.push(`media-src ${directives.mediaSrc.join(' ')}`);
  }
  if (directives.objectSrc) {
    parts.push(`object-src ${directives.objectSrc.join(' ')}`);
  }
  if (directives.frameSrc) {
    parts.push(`frame-src ${directives.frameSrc.join(' ')}`);
  }
  if (directives.frameAncestors) {
    parts.push(`frame-ancestors ${directives.frameAncestors.join(' ')}`);
  }
  if (directives.formAction) {
    parts.push(`form-action ${directives.formAction.join(' ')}`);
  }
  if (directives.baseUri) {
    parts.push(`base-uri ${directives.baseUri.join(' ')}`);
  }
  if (directives.upgradeInsecureRequests) {
    parts.push('upgrade-insecure-requests');
  }

  return parts.join('; ');
}

/**
 * Build Permissions-Policy header value
 */
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

/**
 * Create security headers middleware
 */
export function securityHeaders(options: SecurityHeadersOptions = {}): NaraMiddleware {
  const isProduction = process.env.NODE_ENV === 'production';

  // Resolve HSTS options
  const hstsOptions: HSTSOptions = typeof options.hsts === 'object'
    ? options.hsts
    : { enabled: options.hsts !== false && isProduction };

  const hstsEnabled = hstsOptions.enabled !== false && isProduction;
  const hstsMaxAge = hstsOptions.maxAge ?? 31536000; // 1 year
  const hstsIncludeSubDomains = hstsOptions.includeSubDomains !== false;
  const hstsPreload = hstsOptions.preload === true;

  // Resolve CSP options
  const cspOptions: CSPOptions = typeof options.csp === 'object'
    ? options.csp
    : { enabled: false }; // CSP is opt-in

  const cspEnabled = cspOptions.enabled === true;
  const cspDirectives = { ...DEFAULT_CSP_DIRECTIVES, ...cspOptions.directives };
  const cspReportOnly = cspOptions.reportOnly === true;

  // Resolve Permissions-Policy
  const permissionsPolicy = options.permissionsPolicy !== false
    ? { ...DEFAULT_PERMISSIONS_POLICY, ...(typeof options.permissionsPolicy === 'object' ? options.permissionsPolicy : {}) }
    : null;

  // Pre-build header values for performance
  const hstsValue = hstsEnabled
    ? `max-age=${hstsMaxAge}${hstsIncludeSubDomains ? '; includeSubDomains' : ''}${hstsPreload ? '; preload' : ''}`
    : null;

  const cspValue = cspEnabled ? buildCSPHeader(cspDirectives) : null;
  const permissionsPolicyValue = permissionsPolicy ? buildPermissionsPolicy(permissionsPolicy) : null;

  return (_req: NaraRequest, res: NaraResponse, next: () => void) => {
    // HSTS - Only in production with HTTPS
    if (hstsValue) {
      res.setHeader('Strict-Transport-Security', hstsValue);
    }

    // X-Frame-Options
    if (options.frameOptions !== false) {
      res.setHeader('X-Frame-Options', options.frameOptions || 'DENY');
    }

    // X-Content-Type-Options
    if (options.contentTypeOptions !== false) {
      res.setHeader('X-Content-Type-Options', options.contentTypeOptions || 'nosniff');
    }

    // Referrer-Policy
    if (options.referrerPolicy !== false) {
      res.setHeader('Referrer-Policy', options.referrerPolicy || 'strict-origin-when-cross-origin');
    }

    // X-XSS-Protection (legacy)
    if (options.xssProtection !== false) {
      res.setHeader('X-XSS-Protection', options.xssProtection || '0');
    }

    // Content-Security-Policy
    if (cspValue) {
      const headerName = cspReportOnly
        ? 'Content-Security-Policy-Report-Only'
        : 'Content-Security-Policy';

      let value = cspValue;
      if (cspOptions.reportUri) {
        value += `; report-uri ${cspOptions.reportUri}`;
      }

      res.setHeader(headerName, value);
    }

    // Permissions-Policy
    if (permissionsPolicyValue) {
      res.setHeader('Permissions-Policy', permissionsPolicyValue);
    }

    return next();
  };
}

/**
 * Preset: Strict security headers for API endpoints
 */
export function strictSecurityHeaders(): NaraMiddleware {
  return securityHeaders({
    frameOptions: 'DENY',
    contentTypeOptions: 'nosniff',
    referrerPolicy: 'no-referrer',
    xssProtection: '0',
    csp: {
      enabled: true,
      directives: {
        defaultSrc: ["'none'"],
        frameAncestors: ["'none'"],
      },
    },
  });
}

/**
 * Preset: Relaxed security headers for development
 */
export function devSecurityHeaders(): NaraMiddleware {
  return securityHeaders({
    hsts: false,
    frameOptions: 'SAMEORIGIN',
    contentTypeOptions: 'nosniff',
    referrerPolicy: 'strict-origin-when-cross-origin',
    xssProtection: '0',
    csp: false,
  });
}

export default securityHeaders;
