import { randomBytes } from "crypto";
import Logger from "@services/Logger";
import type { NaraRequest, NaraResponse, NaraMiddleware } from "@core";
import { jsonForbidden } from "@core";

export interface CSRFOptions {
  cookieName?: string;
  headerName?: string;
  bodyField?: string;
  tokenLength?: number;
  cookie?: {
    path?: string;
    httpOnly?: boolean;
    secure?: boolean;
    sameSite?: 'strict' | 'lax' | 'none';
    maxAge?: number;
  };
  skip?: (req: NaraRequest) => boolean;
  skipIfAuthorization?: boolean;
  errorMessage?: string;
}

const SAFE_METHODS = ['GET', 'HEAD', 'OPTIONS'];

function generateToken(length: number): string {
  return randomBytes(length).toString('hex');
}

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
    httpOnly: cookie.httpOnly ?? false,
    secure: cookie.secure ?? isProduction,
    sameSite: (cookie.sameSite ?? 'lax') as 'strict' | 'lax' | 'none',
    maxAge: (cookie.maxAge ?? 24 * 60 * 60) * 1000,
  };
  
  return (req: NaraRequest, res: NaraResponse, next: () => void) => {
    let token = req.cookies[cookieName];
    
    if (!token) {
      token = generateToken(tokenLength);
      res.cookie(cookieName, token, {
        maxAge: cookieOptions.maxAge,
        path: cookieOptions.path,
        httpOnly: cookieOptions.httpOnly,
        secure: cookieOptions.secure,
        sameSite: cookieOptions.sameSite,
      });
    }
    
    (req as NaraRequest & { csrfToken: string }).csrfToken = token;
    
    if (SAFE_METHODS.includes(req.method)) {
      return next();
    }
    
    if (skip && skip(req)) {
      return next();
    }
    
    if (skipIfAuthorization && req.headers.authorization) {
      return next();
    }
    
    const headerToken = req.headers[headerName.toLowerCase()] as string | undefined;
    
    let bodyToken: string | undefined;
    if (!headerToken) {
      try {
        const body = (req as NaraRequest & { body?: Record<string, unknown> }).body;
        if (body && typeof body === 'object') {
          bodyToken = body[bodyField] as string | undefined;
        }
      } catch {
      }
    }
    
    const submittedToken = headerToken || bodyToken;
    
    if (!submittedToken || submittedToken !== token) {
      Logger.logSecurity('CSRF validation failed', {
        ip: req.ip,
        path: req.path,
        method: req.method,
        hasToken: !!submittedToken,
        tokenMatch: submittedToken === token,
        userId: req.user?.id,
      });
      
      return jsonForbidden(res, errorMessage);
    }
    
    return next();
  };
}

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
      res.cookie(cookieName, token, {
        maxAge: cookieOptions.maxAge,
        path: cookieOptions.path,
        httpOnly: cookieOptions.httpOnly,
        secure: cookieOptions.secure,
        sameSite: cookieOptions.sameSite,
      });
    }
    
    (req as NaraRequest & { csrfToken: string }).csrfToken = token;
    
    return next();
  };
}

export function getCSRFToken(req: NaraRequest): string | undefined {
  return (req as NaraRequest & { csrfToken?: string }).csrfToken;
}

export default csrf;
