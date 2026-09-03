import { randomUUID } from 'node:crypto';
import { getCookie, deleteCookie, setCookie } from 'hono/cookie';
import { Hono } from 'hono';
import type { Context } from 'hono';
import { z } from 'zod';
import {
  changePasswordInputSchema,
  loginInputSchema,
  registerInputSchema,
  type CurrentUser,
} from '../contract';
import { getUserPermissions, getUserRoles } from './access';
import { AUTH, env } from '../../../shared/config';
import { Logger } from '../../../shared/logging';
import { createUser, findUserByEmail, findUserById, updatePassword, type SessionUser } from './repository';
import {
  checkPassword,
  currentUser,
  endSession,
  hashPassword,
  SESSION_COOKIE_NAME,
  startSession,
} from './service';

function validationErrors(error: z.ZodError): Record<string, string[]> {
  const errors: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.') || '_root';
    errors[key] ??= [];
    errors[key].push(issue.message);
  }
  return errors;
}

async function requestBody(context: Context): Promise<unknown> {
  try {
    return await context.req.json();
  } catch {
    return {};
  }
}

function setSessionCookie(context: Context, token: string): void {
  setCookie(context, SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'Lax',
    path: '/',
    maxAge: AUTH.SESSION_EXPIRY_MS / 1000,
  });
}

function isUniqueConstraintError(error: unknown): boolean {
  return error instanceof Error && 'code' in error && error.code === 'SQLITE_CONSTRAINT_UNIQUE';
}

const registerHandler = async (context: Context) => {
  const parsed = registerInputSchema.safeParse(await requestBody(context));
  if (!parsed.success) {
    const errors = validationErrors(parsed.error);
    return context.json(
      {
        success: false as const,
        message: 'Validation failed',
        code: 'VALIDATION_ERROR',
        errors,
      },
      422,
    );
  }

  try {
    const user = createUser({
      id: randomUUID(),
      name: parsed.data.name,
      email: parsed.data.email,
      password: hashPassword(parsed.data.password),
    });
    const token = startSession(user, context.req.header('user-agent'));
    setSessionCookie(context, token);
    Logger.logAuth('registration_success', { userId: user.id });

    return context.json(
      {
        success: true as const,
        message: 'Registration successful',
        data: { user: { id: user.id, name: user.name, email: user.email, avatar: user.avatar } },
      },
      201,
    );
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return context.json(
        { success: false as const, message: 'Email already in use', code: 'DUPLICATE_EMAIL' },
        400,
      );
    }
    throw error;
  }
};

const loginHandler = async (context: Context) => {
  const parsed = loginInputSchema.safeParse(await requestBody(context));
  if (!parsed.success) {
    const errors = validationErrors(parsed.error);
    return context.json(
      {
        success: false as const,
        message: 'Validation failed',
        code: 'VALIDATION_ERROR',
        errors,
      },
      422,
    );
  }

  const user = findUserByEmail(parsed.data.email);
  if (!checkPassword(parsed.data.password, user)) {
    Logger.logSecurity('login_failed', { email: parsed.data.email });
    return context.json(
      { success: false as const, message: 'Invalid email or password', code: 'INVALID_CREDENTIALS' },
      401,
    );
  }

  const token = startSession(user!, context.req.header('user-agent'));
  setSessionCookie(context, token);
  Logger.logAuth('login_success', { userId: user!.id });
  return context.json({ success: true as const, message: 'Login successful' });
};

const changePasswordHandler = async (context: Context) => {
  const sessionUser = currentUser(getCookie(context, SESSION_COOKIE_NAME));
  if (!sessionUser) {
    return context.json({ success: false as const, message: 'Unauthorized', code: 'UNAUTHORIZED' }, 401);
  }

  const user = findUserById(sessionUser.id);
  if (!user) {
    return context.json({ success: false as const, message: 'User not found', code: 'NOT_FOUND' }, 404);
  }

  const parsed = changePasswordInputSchema.safeParse(await requestBody(context));
  if (!parsed.success) {
    return context.json(
      {
        success: false as const,
        message: 'Validation failed',
        code: 'VALIDATION_ERROR',
        errors: validationErrors(parsed.error),
      },
      422,
    );
  }

  if (!checkPassword(parsed.data.current_password, user)) {
    return context.json(
      { success: false as const, message: 'Current password is incorrect', code: 'INVALID_PASSWORD' },
      400,
    );
  }

  updatePassword(user.id, hashPassword(parsed.data.new_password));
  const token = startSession(user, context.req.header('user-agent'));
  setSessionCookie(context, token);
  Logger.logAuth('password_changed', { userId: user.id });
  return context.json({ success: true as const, message: 'Password updated' });
};

function currentUserPayload(user: SessionUser): CurrentUser {
  return {
    ...user,
    roles: getUserRoles(user.id).map((role) => role.slug),
    permissions: getUserPermissions(user.id).map((permission) => permission.slug),
  };
}

const currentUserHandler = (context: Context) => {
  const user = currentUser(getCookie(context, SESSION_COOKIE_NAME));
  if (!user) {
    return context.json({ success: false as const, message: 'Unauthorized', code: 'UNAUTHORIZED' }, 401);
  }
  return context.json({ success: true as const, message: 'OK', data: { user: currentUserPayload(user) } });
};

const logoutHandler = (context: Context) => {
  endSession(getCookie(context, SESSION_COOKIE_NAME));
  deleteCookie(context, SESSION_COOKIE_NAME, { path: '/' });
  return context.json({ success: true as const, message: 'Logout successful' });
};

export const authRoutes = new Hono()
  .post('/register', registerHandler)
  .post('/login', loginHandler)
  .post('/change-password', changePasswordHandler)
  .get('/me', currentUserHandler)
  .post('/logout', logoutHandler);
