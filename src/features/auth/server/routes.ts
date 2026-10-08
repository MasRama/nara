import { randomUUID } from 'node:crypto';
import { getCookie, deleteCookie } from 'hono/cookie';
import { Hono } from 'hono';
import type { Context } from 'hono';
import {
  changePasswordInputSchema,
  loginInputSchema,
  registerInputSchema,
  type AuthSuccess,
  type CsrfTokenSuccess,
  type CurrentUser,
  type CurrentUserSuccess,
  type LoginSuccess,
  type RegisterSuccess,
} from '../contract';
import { getUserPermissions, getUserRoles } from './access';
import { clientIp, requestCsrfToken } from '../../../shared/security';
import { Logger } from '../../../shared/logging';
import {
  createUser,
  deleteSessionsByUserId,
  findUserByEmail,
  findUserById,
  updatePassword,
  type SessionUser,
} from './repository';
import {
  clearLoginAttempts,
  isLockedOut,
  recordFailedAttempt,
  remainingLockoutMs,
} from './login-throttle';
import {
  checkPassword,
  currentUser,
  endSession,
  hashPassword,
  SESSION_COOKIE_NAME,
  startSession,
} from './service';
import type { AuthActivitySink } from './activity';
import { requestBody, setSessionCookie, validationErrors } from './http';
import { beginTwoFactorChallenge, createSecurityRoutes } from './security-routes';
import { sessionGuard } from './guard';

function isUniqueConstraintError(error: unknown): boolean {
  return error instanceof Error && 'code' in error && error.code === 'SQLITE_CONSTRAINT_UNIQUE';
}

const registerHandler = async (context: Context, activity?: AuthActivitySink) => {
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
      password: await hashPassword(parsed.data.password),
    });
    const token = startSession(user, context.req.header('user-agent'), clientIp(context));
    setSessionCookie(context, token);
    Logger.logAuth('registration_success', { userId: user.id });
    activity?.({
      action: 'auth.registered',
      resource: 'auth',
      actorId: user.id,
      targetId: user.id,
      targetLabel: user.name,
    });

    return context.json(
      {
        success: true as const,
        message: 'Registration successful',
        data: { user: { id: user.id, name: user.name, email: user.email, avatar: user.avatar } },
      } satisfies RegisterSuccess,
      201,
    );
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return context.json(
        { success: false as const, message: 'Email already in use', code: 'DUPLICATE_EMAIL' },
        409,
      );
    }
    throw error;
  }
};

const loginHandler = async (context: Context, activity?: AuthActivitySink) => {
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

  const identifier = parsed.data.email.trim().toLowerCase();
  const ip = clientIp(context);

  if (isLockedOut(identifier, ip)) {
    const minutes = Math.max(1, Math.ceil(remainingLockoutMs(identifier, ip) / 60_000));
    Logger.logSecurity('login_blocked_locked', { email: parsed.data.email });
    return context.json(
      {
        success: false as const,
        message: `Too many attempts. Try again in ${minutes} minutes.`,
        code: 'RATE_LIMITED',
      },
      429,
    );
  }

  const user = findUserByEmail(parsed.data.email);
  // checkPassword always runs a hash comparison (dummy hash for unknown
  // emails) so failure timing does not disclose account existence.
  if (!(await checkPassword(parsed.data.password, user))) {
    const result = recordFailedAttempt(identifier, ip);
    Logger.logSecurity('login_failed', { email: parsed.data.email });
    return context.json(
      {
        success: false as const,
        message: result.isLocked
          ? `Too many attempts. Try again in ${Math.max(1, Math.ceil(result.lockoutMs / 60_000))} minutes.`
          : 'Invalid email or password',
        code: 'INVALID_CREDENTIALS',
      },
      401,
    );
  }

  clearLoginAttempts(identifier, ip);
  if (beginTwoFactorChallenge(context, user!.id)) {
    Logger.logAuth('login_two_factor_required', { userId: user!.id });
    return context.json({
      success: true as const,
      message: 'Two-factor code required',
      data: { twoFactorRequired: true },
    } satisfies LoginSuccess);
  }
  // Re-signing in on this browser replaces its old session instead of orphaning it.
  endSession(getCookie(context, SESSION_COOKIE_NAME));
  const token = startSession(user!, context.req.header('user-agent'), ip);
  setSessionCookie(context, token);
  Logger.logAuth('login_success', { userId: user!.id });
  activity?.({
    action: 'auth.login',
    resource: 'auth',
    actorId: user!.id,
    targetId: user!.id,
    targetLabel: user!.name,
  });
  return context.json({
    success: true as const,
    message: 'Login successful',
    data: { twoFactorRequired: false },
  } satisfies LoginSuccess);
};

const changePasswordHandler = async (context: Context, activity?: AuthActivitySink) => {
  const user = findUserById(sessionGuard.actor(context).id);
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

  if (!(await checkPassword(parsed.data.current_password, user))) {
    return context.json(
      { success: false as const, message: 'Current password is incorrect', code: 'INVALID_PASSWORD' },
      400,
    );
  }

  updatePassword(user.id, await hashPassword(parsed.data.new_password));
  // A credential change signs out every other device; this browser gets a fresh session.
  deleteSessionsByUserId(user.id);
  const token = startSession(user, context.req.header('user-agent'), clientIp(context));
  setSessionCookie(context, token);
  Logger.logAuth('password_changed', { userId: user.id });
  activity?.({
    action: 'auth.password-changed',
    resource: 'auth',
    actorId: user.id,
    targetId: user.id,
    targetLabel: user.name,
  });
  return context.json({ success: true as const, message: 'Password updated' } satisfies AuthSuccess);
};

function currentUserPayload(user: SessionUser): CurrentUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    avatar: user.avatar,
    roles: getUserRoles(user.id).map((role) => role.slug),
    permissions: getUserPermissions(user.id).map((permission) => permission.slug),
    mustChangePassword: user.must_change_password === 1,
  };
}

const currentUserHandler = (context: Context) => {
  const { user } = sessionGuard.actor(context);
  return context.json({
    success: true as const,
    message: 'OK',
    data: { user: currentUserPayload(user) },
  } satisfies CurrentUserSuccess);
};

const csrfHandler = (context: Context) => {
  // The CSRF middleware already ensured the cookie on this safe request;
  // echo the token so browser clients can bootstrap without parsing cookies.
  const token = requestCsrfToken(context) ?? '';
  return context.json({
    success: true as const,
    message: 'CSRF token issued',
    data: { csrfToken: token },
  } satisfies CsrfTokenSuccess);
};

const logoutHandler = (context: Context, activity?: AuthActivitySink) => {
  const sessionToken = getCookie(context, SESSION_COOKIE_NAME);
  const user = currentUser(sessionToken);
  endSession(sessionToken);
  deleteCookie(context, SESSION_COOKIE_NAME, { path: '/' });
  if (user) {
    activity?.({
      action: 'auth.logout',
      resource: 'auth',
      actorId: user.id,
      targetId: user.id,
      targetLabel: user.name,
    });
  }
  return context.json({ success: true as const, message: 'Logout successful' } satisfies AuthSuccess);
};

export function createAuthRoutes(activity?: AuthActivitySink) {
  return new Hono()
    .get('/csrf', csrfHandler)
    .post('/register', (context) => registerHandler(context, activity))
    .post('/login', (context) => loginHandler(context, activity))
    .post('/change-password', sessionGuard.signedIn, (context) => changePasswordHandler(context, activity))
    .get('/me', sessionGuard.signedIn, currentUserHandler)
    .post('/logout', (context) => logoutHandler(context, activity))
    .route('/', createSecurityRoutes(activity));
}

export const authRoutes = createAuthRoutes();
