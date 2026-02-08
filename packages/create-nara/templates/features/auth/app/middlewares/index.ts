/**
 * Middlewares Module
 * 
 * Barrel export for all application middlewares.
 * Import middlewares from this module for cleaner imports.
 * 
 * @example
 * import { Auth, strictRateLimit, csrf } from "@middlewares";
 */

// Authentication
export { webAuthMiddleware as Auth, webAuthMiddleware } from './auth.js';

// Rate Limiting
export { 
  rateLimit, 
  strictRateLimit, 
  apiRateLimit,
  resetRateLimit,
  getRateLimitStoreSize,
} from './rateLimit.js';
export type { RateLimitOptions } from './rateLimit.js';

// CSRF Protection
export { csrf, csrfToken, getCSRFToken } from './csrf.js';
export type { CSRFOptions } from './csrf.js';

// Request Logging
export { 
  requestLogger, 
  verboseRequestLogger, 
  errorOnlyRequestLogger,
} from './requestLogger.js';
export type { RequestLoggerOptions } from './requestLogger.js';

// Security Headers
export { 
  securityHeaders, 
  strictSecurityHeaders, 
  devSecurityHeaders,
} from './securityHeaders.js';
export type { 
  SecurityHeadersOptions, 
  HSTSOptions, 
  CSPOptions, 
  CSPDirectives,
} from './securityHeaders.js';
