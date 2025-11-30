/**
 * CSRF Protection Middleware
 * 
 * Implements Double Submit Cookie pattern for CSRF protection.
 * A random token is stored in a cookie and must be sent back in a header
 * or request body for state-changing requests (POST, PUT, PATCH, DELETE).
 * 
 * How it works:
 * 1. On first request, generates a CSRF token and sets it as a cookie
 * 2. Frontend reads the cookie and includes token in X-CSRF-Token header or _csrf body field
 * 3. Middleware validates that cookie token matches header/body token
 * 
 * Features:
 * - Double Submit Cookie pattern (stateless, no server-side storage)
 * - Configurable cookie options
 * - Skip for API routes with Authorization header (assumes API auth)
 * - Skip for safe methods (GET, HEAD, OPTIONS)
 * 
 * @example
 * // Backend: Apply middleware
 * app.use(csrf());
 * 
 * // Frontend: Include token in requests
 * const csrfToken = document.cookie.match(/csrf_token=([^;]+)/)?.[1];
 * fetch('/api/data', {
 *   method: 'POST',
 *   headers: {
 *     'X-CSRF-Token': csrfToken,
 *     'Content-Type': 'application/json',
 *   },
 *   body: JSON.stringify(data),
 * });
 */

import { randomBytes } from "crypto";
import { HTTP_STATUS } from "@config";
import Logger from "@services/Logger";
import type { NaraRequest, NaraResponse, NaraMiddleware } from "@core";

/**
 * CSRF configuration options
 */
export interface CSRFOptions {
  /** Cookie name for CSRF token (default: 'csrf_token') */
  cookieName?: string;
  /** Header name for CSRF token (default: 'X-CSRF-Token') */
  headerName?: string;
  /** Body field name for CSRF token (default: '_csrf') */
  bodyField?: string;
  /** Token length in bytes (default: 32) */
  tokenLength?: number;
  /** Cookie options */
  cookie?: {
    /** Cookie path (default: '/') */
    path?: string;
    /** HTTP only cookie (default: false - needs to be readable by JS) */
    httpOnly?: boolean;
    /** Secure cookie (default: true in production) */
    secure?: boolean;
    /** SameSite attribute (default: 'lax') */
    sameSite?: 'strict' | 'lax' | 'none';
    /** Cookie max age in seconds (default: 24 hours) */
    maxAge?: number;
  };
  /** Skip CSRF check for certain requests */
  skip?: (req: NaraRequest) => boolean;
  /** Skip for requests with Authorization header (default: true) */
  skipIfAuthorization?: boolean;
  /** Custom error message */
  errorMessage?: string;
}

/**
 * Safe HTTP methods that don't require CSRF protection
 */
const SAFE_METHODS = ['GET', 'HEAD', 'OPTIONS'];

/**
 * Generate a cryptographically secure random token
 */
function generateToken(length: number): string {
  return randomBytes(length).toString('hex');
}

/**
 * Create CSRF protection middleware
 * 
 * @param options - CSRF configuration
 * @returns Middleware function
 */
export function csrf(options: CSRFOptions = {}): NaraMiddleware {
  const isProduction = process.env.NODE_ENV === 'production';
  
  const {
    cookieName = 'csrf_token',
    headerName = 'X-CSRF-Token',
    bodyField = '_csrf',
    tokenLength = 32,
    cookie = {},
    skip,
    skipIfAuthorization = true,
    errorMessage = 'Token CSRF tidak valid',
  } = options;
  
  const cookieOptions = {
    path: cookie.path ?? '/',
    httpOnly: cookie.httpOnly ?? false, // Must be false for JS to read
    secure: cookie.secure ?? isProduction,
    sameSite: (cookie.sameSite ?? 'lax') as 'strict' | 'lax' | 'none',
    maxAge: (cookie.maxAge ?? 24 * 60 * 60) * 1000, // Convert to ms
  };
  
  return async (req: NaraRequest, res: NaraResponse, next: () => void) => {
    // Get existing token from cookie
    let token = req.cookies[cookieName];
    
    // Generate new token if not exists
    if (!token) {
      token = generateToken(tokenLength);
      res.cookie(cookieName, token, cookieOptions.maxAge, {
        path: cookieOptions.path,
        httpOnly: cookieOptions.httpOnly,
        secure: cookieOptions.secure,
        sameSite: cookieOptions.sameSite,
      });
    }
    
    // Attach token to request for use in templates
    (req as NaraRequest & { csrfToken: string }).csrfToken = token;
    
    // Skip for safe methods
    if (SAFE_METHODS.includes(req.method)) {
      return next();
    }
    
    // Skip if custom skip function returns true
    if (skip && skip(req)) {
      return next();
    }
    
    // Skip if Authorization header present (API auth)
    if (skipIfAuthorization && req.headers.authorization) {
      return next();
    }
    
    // Get token from header or body
    const headerToken = req.headers[headerName.toLowerCase()] as string | undefined;
    
    // Try to get from body if not in header
    let bodyToken: string | undefined;
    if (!headerToken) {
      try {
        // Check if body has been parsed
        const body = (req as NaraRequest & { body?: Record<string, unknown> }).body;
        if (body && typeof body === 'object') {
          bodyToken = body[bodyField] as string | undefined;
        }
      } catch {
        // Body not available or not parsed
      }
    }
    
    const submittedToken = headerToken || bodyToken;
    
    // Validate token
    if (!submittedToken || submittedToken !== token) {
      Logger.logSecurity('CSRF validation failed', {
        ip: req.ip,
        path: req.path,
        method: req.method,
        hasToken: !!submittedToken,
        tokenMatch: submittedToken === token,
        userId: req.user?.id,
      });
      
      return res.status(HTTP_STATUS.FORBIDDEN).json({
        success: false,
        message: errorMessage,
        code: 'CSRF_INVALID',
      });
    }
    
    return next();
  };
}

/**
 * Middleware to generate and expose CSRF token without validation
 * Useful for initial page loads where you need the token
 * 
 * @example
 * // Apply to routes that render forms
 * Route.get('/login', csrfToken(), AuthController.loginPage);
 */
export function csrfToken(options: Pick<CSRFOptions, 'cookieName' | 'tokenLength' | 'cookie'> = {}): NaraMiddleware {
  const isProduction = process.env.NODE_ENV === 'production';
  
  const {
    cookieName = 'csrf_token',
    tokenLength = 32,
    cookie = {},
  } = options;
  
  const cookieOptions = {
    path: cookie.path ?? '/',
    httpOnly: cookie.httpOnly ?? false,
    secure: cookie.secure ?? isProduction,
    sameSite: (cookie.sameSite ?? 'lax') as 'strict' | 'lax' | 'none',
    maxAge: (cookie.maxAge ?? 24 * 60 * 60) * 1000,
  };
  
  return (req: NaraRequest, res: NaraResponse, next: () => void) => {
    let token = req.cookies[cookieName];
    
    if (!token) {
      token = generateToken(tokenLength);
      res.cookie(cookieName, token, cookieOptions.maxAge, {
        path: cookieOptions.path,
        httpOnly: cookieOptions.httpOnly,
        secure: cookieOptions.secure,
        sameSite: cookieOptions.sameSite,
      });
    }
    
    // Attach token to request
    (req as NaraRequest & { csrfToken: string }).csrfToken = token;
    
    return next();
  };
}

/**
 * Helper to get CSRF token from request (for use in controllers/views)
 */
export function getCSRFToken(req: NaraRequest): string | undefined {
  return (req as NaraRequest & { csrfToken?: string }).csrfToken;
}

export default csrf;
