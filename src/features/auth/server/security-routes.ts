import { Hono } from 'hono';
import type { Context } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import { randomUUID } from 'node:crypto';
import {
  confirmPasswordInputSchema,
  twoFactorChallengeInputSchema,
  twoFactorCodeInputSchema,
  type SessionData,
} from '../contract';
import { AUTH, env } from '../../../shared/config';
import { clientIp, createGuard } from '../../../shared/security';
import { Logger } from '../../../shared/logging';
import type { AuthActivitySink } from './activity';
import { requestBody, setSessionCookie, validationFailed } from './http';
import {
  consumeRecoveryCode,
  countUnusedRecoveryCodes,
  createTwoFactorChallenge,
  deleteOtherSessions,
  deleteSessionByHandle,
  deleteTwoFactorChallenge,
  disableTwoFactor,
  enableTwoFactor,
  findTwoFactorChallenge,
  findTwoFactorState,
  findUserById,
  listActiveSessions,
  recordChallengeFailure,
  recordTwoFactorStep,
  replaceRecoveryCodes,
  setPendingTwoFactorSecret,
  type StoredUser,
} from './repository';
import { checkPassword, currentUser, endSession, SESSION_COOKIE_NAME, startSession } from './service';
import { generateRecoveryCodes, generateTotpSecret, hashRecoveryCode, otpauthUrl, verifyTotp } from './totp';

/** HttpOnly cookie carrying a pending two-factor challenge id, scoped to its one endpoint. */
export const TWO_FACTOR_COOKIE_NAME = 'auth_2fa';
const TWO_FACTOR_COOKIE_PATH = '/api/auth/two-factor/challenge';

/**
 * Called by the password step once credentials are verified. Returns true when
 * the account requires a second factor and a challenge cookie was issued, in
 * which case no session may be created yet.
 */
export function beginTwoFactorChallenge(context: Context, userId: string): boolean {
  if (findTwoFactorState(userId)?.two_factor_enabled_at == null) return false;
  const id = randomUUID();
  createTwoFactorChallenge({
    id,
    userId,
    userAgent: context.req.header('user-agent'),
    ipAddress: clientIp(context),
    expiresAt: Date.now() + AUTH.TWO_FACTOR_CHALLENGE_TTL_MS,
  });
  setCookie(context, TWO_FACTOR_COOKIE_NAME, id, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'Lax',
    path: TWO_FACTOR_COOKIE_PATH,
    maxAge: AUTH.TWO_FACTOR_CHALLENGE_TTL_MS / 1000,
  });
  return true;
}

function clearChallenge(context: Context, id: string): void {
  deleteTwoFactorChallenge(id);
  deleteCookie(context, TWO_FACTOR_COOKIE_NAME, { path: TWO_FACTOR_COOKIE_PATH });
}

const challengeExpired = (context: Context) =>
  context.json(
    {
      success: false as const,
      message: 'Your sign-in expired. Enter your password again.',
      code: 'TWO_FACTOR_CHALLENGE_EXPIRED',
    },
    401,
  );

const challengeHandler = async (context: Context, activity?: AuthActivitySink) => {
  const challengeId = getCookie(context, TWO_FACTOR_COOKIE_NAME);
  const challenge = challengeId ? findTwoFactorChallenge(challengeId) : undefined;
  if (!challenge) return challengeExpired(context);

  const parsed = twoFactorChallengeInputSchema.safeParse(await requestBody(context));
  if (!parsed.success) return validationFailed(context, parsed.error);

  const user = findUserById(challenge.user_id);
  const state = findTwoFactorState(challenge.user_id);
  if (!user || !state?.two_factor_secret) {
    clearChallenge(context, challenge.id);
    return challengeExpired(context);
  }

  let verified: boolean;
  if (parsed.data.code !== undefined) {
    const step = verifyTotp(state.two_factor_secret, parsed.data.code, { lastUsedStep: state.two_factor_last_step });
    // The conditional update closes the race where two requests submit the same code.
    verified = step !== null && recordTwoFactorStep(user.id, step);
  } else {
    verified = consumeRecoveryCode(user.id, hashRecoveryCode(parsed.data.recovery_code!));
  }

  if (!verified) {
    const attempts = recordChallengeFailure(challenge.id);
    Logger.logSecurity('two_factor_failed', { userId: user.id, attempts });
    if (attempts >= AUTH.TWO_FACTOR_MAX_ATTEMPTS) {
      clearChallenge(context, challenge.id);
      return context.json(
        { success: false as const, message: 'Too many invalid codes. Sign in again.', code: 'TWO_FACTOR_LOCKED' },
        429,
      );
    }
    return context.json(
      { success: false as const, message: 'Invalid authentication code', code: 'INVALID_TWO_FACTOR_CODE' },
      401,
    );
  }

  clearChallenge(context, challenge.id);
  endSession(getCookie(context, SESSION_COOKIE_NAME));
  const token = startSession(user, context.req.header('user-agent'), clientIp(context));
  setSessionCookie(context, token);
  const method = parsed.data.code !== undefined ? 'authenticator' : 'recovery-code';
  Logger.logAuth('login_success', { userId: user.id, twoFactor: method });
  activity?.({
    action: 'auth.login',
    resource: 'auth',
    actorId: user.id,
    targetId: user.id,
    targetLabel: user.name,
    metadata:
      method === 'recovery-code'
        ? { twoFactor: method, recoveryCodesRemaining: countUnusedRecoveryCodes(user.id) }
        : { twoFactor: method },
  });
  return context.json({ success: true as const, message: 'Login successful' });
};

interface Authenticated {
  id: string;
  token: string;
  user: StoredUser;
}

const accountGuard = createGuard((context): Authenticated | undefined => {
  const token = getCookie(context, SESSION_COOKIE_NAME);
  const sessionUser = currentUser(token);
  const user = sessionUser ? findUserById(sessionUser.id) : undefined;
  return token && user ? { id: user.id, token, user } : undefined;
});

const invalidPassword = (context: Context) =>
  context.json({ success: false as const, message: 'Password is incorrect', code: 'INVALID_PASSWORD' }, 400);

/** Re-authenticates with the current password; returns an error response or undefined. */
async function confirmPassword(context: Context, user: StoredUser) {
  const parsed = confirmPasswordInputSchema.safeParse(await requestBody(context));
  if (!parsed.success) return validationFailed(context, parsed.error);
  if (!(await checkPassword(parsed.data.password, user))) {
    Logger.logSecurity('security_password_confirmation_failed', { userId: user.id });
    return invalidPassword(context);
  }
  return undefined;
}

function twoFactorStatus(userId: string) {
  const state = findTwoFactorState(userId);
  const enabled = state?.two_factor_enabled_at != null;
  return {
    enabled,
    enabledAt: state?.two_factor_enabled_at ?? null,
    recoveryCodesRemaining: enabled ? countUnusedRecoveryCodes(userId) : 0,
  };
}

export function createSecurityRoutes(activity?: AuthActivitySink) {
  const record = (user: StoredUser, action: Parameters<AuthActivitySink>[0]['action'], metadata?: Record<string, number>) =>
    activity?.({ action, resource: 'auth', actorId: user.id, targetId: user.id, targetLabel: user.name, metadata });

  return new Hono()
    .post('/two-factor/challenge', (context) => challengeHandler(context, activity))
    .get('/sessions', accountGuard.signedIn, (context) => {
      const auth = accountGuard.actor(context);
      const sessions: SessionData[] = listActiveSessions(auth.user.id).map((session) => ({
        id: session.handle,
        userAgent: session.user_agent,
        ipAddress: session.ip_address,
        createdAt: session.created_at,
        lastSeenAt: session.last_seen_at,
        current: session.id === auth.token,
      }));
      return context.json({ success: true as const, message: 'OK', data: { sessions } });
    })
    .post('/sessions/revoke-others', accountGuard.signedIn, (context) => {
      const auth = accountGuard.actor(context);
      const revoked = deleteOtherSessions(auth.user.id, auth.token);
      if (revoked > 0) record(auth.user, 'auth.sessions-revoked', { revoked });
      return context.json({ success: true as const, message: 'Other sessions signed out', data: { revoked } });
    })
    .delete('/sessions/:id', accountGuard.signedIn, (context) => {
      const auth = accountGuard.actor(context);
      const handle = context.req.param('id');
      const target = listActiveSessions(auth.user.id).find((session) => session.handle === handle);
      if (!target) {
        return context.json({ success: false as const, message: 'Session not found', code: 'NOT_FOUND' }, 404);
      }
      if (target.id === auth.token) {
        return context.json(
          { success: false as const, message: 'Use sign out to end the current session', code: 'CURRENT_SESSION' },
          409,
        );
      }
      deleteSessionByHandle(auth.user.id, handle);
      record(auth.user, 'auth.session-revoked');
      return context.json({ success: true as const, message: 'Session signed out', data: { revoked: 1 } });
    })
    .get('/two-factor', accountGuard.signedIn, (context) => {
      const auth = accountGuard.actor(context);
      return context.json({ success: true as const, message: 'OK', data: { twoFactor: twoFactorStatus(auth.user.id) } });
    })
    .post('/two-factor/setup', accountGuard.signedIn, async (context) => {
      const auth = accountGuard.actor(context);
      if (twoFactorStatus(auth.user.id).enabled) {
        return context.json(
          { success: false as const, message: 'Two-factor authentication is already enabled', code: 'TWO_FACTOR_ENABLED' },
          409,
        );
      }
      const failure = await confirmPassword(context, auth.user);
      if (failure) return failure;
      const secret = generateTotpSecret();
      setPendingTwoFactorSecret(auth.user.id, secret);
      return context.json({
        success: true as const,
        message: 'Scan the code with your authenticator app',
        data: { secret, otpauthUrl: otpauthUrl({ issuer: AUTH.TWO_FACTOR_ISSUER, account: auth.user.email, secret }) },
      });
    })
    .post('/two-factor/enable', accountGuard.signedIn, async (context) => {
      const auth = accountGuard.actor(context);
      const state = findTwoFactorState(auth.user.id);
      if (state?.two_factor_enabled_at != null) {
        return context.json(
          { success: false as const, message: 'Two-factor authentication is already enabled', code: 'TWO_FACTOR_ENABLED' },
          409,
        );
      }
      if (!state?.two_factor_pending_secret) {
        return context.json(
          { success: false as const, message: 'Start two-factor setup first', code: 'TWO_FACTOR_SETUP_REQUIRED' },
          409,
        );
      }
      const parsed = twoFactorCodeInputSchema.safeParse(await requestBody(context));
      if (!parsed.success) return validationFailed(context, parsed.error);
      const step = verifyTotp(state.two_factor_pending_secret, parsed.data.code);
      if (step === null) {
        return context.json(
          {
            success: false as const,
            message: 'Validation failed',
            code: 'VALIDATION_ERROR',
            errors: { code: ['That code did not match. Check your device clock and try again.'] },
          },
          422,
        );
      }
      const recoveryCodes = generateRecoveryCodes();
      enableTwoFactor(auth.user.id, state.two_factor_pending_secret, step, recoveryCodes.map(hashRecoveryCode));
      Logger.logAuth('two_factor_enabled', { userId: auth.user.id });
      record(auth.user, 'auth.two-factor-enabled');
      return context.json({ success: true as const, message: 'Two-factor authentication enabled', data: { recoveryCodes } });
    })
    .post('/two-factor/disable', accountGuard.signedIn, async (context) => {
      const auth = accountGuard.actor(context);
      if (!twoFactorStatus(auth.user.id).enabled) {
        return context.json(
          { success: false as const, message: 'Two-factor authentication is not enabled', code: 'TWO_FACTOR_DISABLED' },
          409,
        );
      }
      const failure = await confirmPassword(context, auth.user);
      if (failure) return failure;
      disableTwoFactor(auth.user.id);
      Logger.logAuth('two_factor_disabled', { userId: auth.user.id });
      record(auth.user, 'auth.two-factor-disabled');
      return context.json({ success: true as const, message: 'Two-factor authentication disabled' });
    })
    .post('/two-factor/recovery-codes', accountGuard.signedIn, async (context) => {
      const auth = accountGuard.actor(context);
      if (!twoFactorStatus(auth.user.id).enabled) {
        return context.json(
          { success: false as const, message: 'Two-factor authentication is not enabled', code: 'TWO_FACTOR_DISABLED' },
          409,
        );
      }
      const failure = await confirmPassword(context, auth.user);
      if (failure) return failure;
      const recoveryCodes = generateRecoveryCodes();
      replaceRecoveryCodes(auth.user.id, recoveryCodes.map(hashRecoveryCode));
      record(auth.user, 'auth.recovery-codes-regenerated');
      return context.json({ success: true as const, message: 'Recovery codes regenerated', data: { recoveryCodes } });
    });
}
