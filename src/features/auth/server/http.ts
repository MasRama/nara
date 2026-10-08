import type { Context } from 'hono';
import { setCookie } from 'hono/cookie';
import type { z } from 'zod';
import { AUTH, env } from '../../../shared/config';
import { SESSION_COOKIE_NAME } from './service';

export function validationErrors(error: z.ZodError): Record<string, string[]> {
  const errors: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.') || '_root';
    errors[key] ??= [];
    errors[key].push(issue.message);
  }
  return errors;
}

export function validationFailed(context: Context, error: z.ZodError) {
  return context.json(
    { success: false as const, message: 'Validation failed', code: 'VALIDATION_ERROR', errors: validationErrors(error) },
    422,
  );
}

export function unauthorized(context: Context) {
  return context.json({ success: false as const, message: 'Unauthorized', code: 'UNAUTHORIZED' }, 401);
}

export async function requestBody(context: Context): Promise<unknown> {
  try {
    return await context.req.json();
  } catch {
    return {};
  }
}

export function setSessionCookie(context: Context, token: string): void {
  setCookie(context, SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'Lax',
    path: '/',
    maxAge: AUTH.SESSION_EXPIRY_MS / 1000,
  });
}
