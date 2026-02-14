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
export { default as Auth } from './auth';

// Rate Limiting
export { 
  rateLimit, 
  strictRateLimit, 
  apiRateLimit,
  resetRateLimit,
  getRateLimitStoreSize,
} from './rateLimit';
export type { RateLimitOptions } from './rateLimit';

// CSRF Protection
export { csrf, csrfToken, getCSRFToken } from './csrf';
export type { CSRFOptions } from './csrf';

// Inertia.js
export { default as inertia } from './inertia';

// Request Logging
export {
  requestLogger,
  verboseRequestLogger,
  errorOnlyRequestLogger,
} from './requestLogger';
export type { RequestLoggerOptions } from './requestLogger';

// Authorization
export { authorize, authorizeOrFail } from './authorize';

// Security Headers
export {
  securityHeaders,
  strictSecurityHeaders,
  devSecurityHeaders,
} from './securityHeaders';
export type {
  SecurityHeadersOptions,
  HSTSOptions,
  CSPOptions,
  CSPDirectives,
} from './securityHeaders';

// Input Sanitization
export {
  inputSanitize,
  sanitizeHtml,
  stripHtml,
  sanitizeInput,
  createSanitizer,
  sanitizers,
} from './inputSanitize';
export type { InputSanitizeOptions } from './inputSanitize';
