import type { Context } from 'hono';
import { setCookie } from 'hono/cookie';
import { env } from '../../../shared/config';
import { AUTH } from './config';
import { SESSION_COOKIE_NAME } from './service';

export function setSessionCookie(context: Context, token: string): void {
  setCookie(context, SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'Lax',
    path: '/',
    maxAge: AUTH.SESSION_EXPIRY_MS / 1000,
  });
}
