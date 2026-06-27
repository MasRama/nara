import type { NaraRequest, NaraResponse, NaraMiddleware } from "@core/types";

export interface HSTSOptions {
  maxAge?: number;
  includeSubDomains?: boolean;
  preload?: boolean;
  enabled?: boolean;
}

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

export interface CSPOptions {
  directives?: CSPDirectives;
  reportOnly?: boolean;
  reportUri?: string;
  enabled?: boolean;
}

export interface SecurityHeadersOptions {
  hsts?: HSTSOptions | boolean;
  frameOptions?: 'DENY' | 'SAMEORIGIN' | false;
  contentTypeOptions?: 'nosniff' | false;
  referrerPolicy?: string | false;
  xssProtection?: string | false;
  csp?: CSPOptions | false;
  permissionsPolicy?: Record<string, string[]> | false;
  coep?: 'require-corp' | 'credentialless' | false;
  coop?: 'same-origin' | 'same-origin-allow-popups' | 'unsafe-none' | false;
  corp?: 'same-origin' | 'same-site' | 'cross-origin' | false;
}

const DEFAULT_CSP_DIRECTIVES: CSPDirectives = {
  defaultSrc: ["'self'"],
  scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
  styleSrc: ["'self'", "'unsafe-inline'"],
  imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
  fontSrc: ["'self'", 'data:', 'https:'],
  connectSrc: ["'self'", 'https:', 'wss:'],
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
  
  const hstsOptions: HSTSOptions = typeof options.hsts === 'object'
    ? options.hsts
    : { enabled: options.hsts !== false && isProduction };
  
  const hstsEnabled = hstsOptions.enabled !== false && isProduction;
  const hstsMaxAge = hstsOptions.maxAge ?? 31536000;
  const hstsIncludeSubDomains = hstsOptions.includeSubDomains !== false;
  const hstsPreload = hstsOptions.preload === true;
  
  const cspOptions: CSPOptions = typeof options.csp === 'object'
    ? options.csp
    : { enabled: false };
  
  const cspEnabled = cspOptions.enabled === true;
  const cspDirectives = { ...DEFAULT_CSP_DIRECTIVES, ...cspOptions.directives };
  const cspReportOnly = cspOptions.reportOnly === true;
  
  const permissionsPolicy = options.permissionsPolicy !== false
    ? { ...DEFAULT_PERMISSIONS_POLICY, ...(typeof options.permissionsPolicy === 'object' ? options.permissionsPolicy : {}) }
    : null;
  
  const hstsValue = hstsEnabled
    ? `max-age=${hstsMaxAge}${hstsIncludeSubDomains ? '; includeSubDomains' : ''}${hstsPreload ? '; preload' : ''}`
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
      
      let value = cspValue;
      if (cspOptions.reportUri) {
        value += `; report-uri ${cspOptions.reportUri}`;
      }
      
      res.setHeader(headerName, value);
    }
    
    if (permissionsPolicyValue) {
      res.setHeader('Permissions-Policy', permissionsPolicyValue);
    }
    
    if (options.coep) res.setHeader('Cross-Origin-Embedder-Policy', options.coep);
    if (options.coop) res.setHeader('Cross-Origin-Opener-Policy', options.coop);
    if (options.corp) res.setHeader('Cross-Origin-Resource-Policy', options.corp);
    
    return next();
  };
}

export default securityHeaders;
