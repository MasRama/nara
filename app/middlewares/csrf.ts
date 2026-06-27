import { randomBytes, timingSafeEqual } from "crypto";
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

function buildCookieOptions(cookie: CSRFOptions['cookie'] = {}) {
  const isProduction = process.env.NODE_ENV === 'production';
  return {
    path: cookie.path ?? '/',
    httpOnly: cookie.httpOnly ?? false,
    secure: cookie.secure ?? isProduction,
    sameSite: (cookie.sameSite ?? 'lax') as 'strict' | 'lax' | 'none',
    maxAge: (cookie.maxAge ?? 24 * 60 * 60) * 1000,
  };
}

function ensureToken(req: NaraRequest, res: NaraResponse, cookieName: string, tokenLength: number, cookieOpts: ReturnType<typeof buildCookieOptions>): string {
  let token = req.cookies[cookieName];
  if (!token) {
    token = randomBytes(tokenLength).toString('hex');
    res.cookie(cookieName, token, cookieOpts);
  }
  (req as NaraRequest & { csrfToken: string }).csrfToken = token;
  return token;
}

export function csrf(options: CSRFOptions = {}): NaraMiddleware {
  const {
    cookieName = 'csrf_token',
    headerName = 'X-CSRF-Token',
    bodyField = '_csrf',
    tokenLength = 32,
    cookie = {},
    skip,
    skipIfAuthorization = false,
    errorMessage = 'Token CSRF tidak valid',
  } = options;

  const cookieOpts = buildCookieOptions(cookie);

  return (req: NaraRequest, res: NaraResponse, next: () => void) => {
    const token = ensureToken(req, res, cookieName, tokenLength, cookieOpts);

    if (SAFE_METHODS.includes(req.method)) return next();
    if (skip && skip(req)) return next();
    if (skipIfAuthorization && req.headers.authorization) return next();

    const headerToken = req.headers[headerName.toLowerCase()] as string | undefined;
    let bodyToken: string | undefined;
    if (!headerToken && req.body && typeof req.body === 'object') {
      bodyToken = (req.body as Record<string, unknown>)[bodyField] as string | undefined;
    }

    const submittedToken = headerToken || bodyToken;

    if (!submittedToken) {
      Logger.logSecurity('CSRF validation failed - missing token', {
        ip: req.ip, path: req.path, method: req.method, userId: req.user?.id,
      });
      return jsonForbidden(res, errorMessage);
    }

    // Timing-safe comparison to prevent token brute-force via timing
    const a = Buffer.from(submittedToken);
    const b = Buffer.from(token);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      Logger.logSecurity('CSRF validation failed - invalid token', {
        ip: req.ip, path: req.path, method: req.method, userId: req.user?.id,
      });
      return jsonForbidden(res, errorMessage);
    }

    return next();
  };
}

export function csrfToken(options: Pick<CSRFOptions, 'cookieName' | 'tokenLength' | 'cookie'> = {}): NaraMiddleware {
  const { cookieName = 'csrf_token', tokenLength = 32, cookie = {} } = options;
  const cookieOpts = buildCookieOptions(cookie);

  return (req: NaraRequest, res: NaraResponse, next: () => void) => {
    ensureToken(req, res, cookieName, tokenLength, cookieOpts);
    return next();
  };
}

export function getCSRFToken(req: NaraRequest): string | undefined {
  return (req as NaraRequest & { csrfToken?: string }).csrfToken;
}

export default csrf;
