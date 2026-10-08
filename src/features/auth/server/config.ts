import { z } from 'zod';
import { readFeatureEnv } from '../../../shared/config';

const environment = readFeatureEnv('auth', {
  AUTH_LOCKOUT_ATTEMPTS: z.coerce.number().int().positive().default(5),
  AUTH_LOCKOUT_WINDOW_MS: z.coerce.number().int().positive().default(15 * 60 * 1000),
});

export const AUTH = {
  SESSION_EXPIRY_MS: 60 * 24 * 60 * 60 * 1000,
  /** Oldest sessions beyond this per-account cap are revoked on sign-in. */
  MAX_SESSIONS_PER_USER: 10,
  /** last_seen_at is written at most once per interval per session. */
  SESSION_TOUCH_INTERVAL_MS: 5 * 60 * 1000,
  TWO_FACTOR_ISSUER: 'Nara',
  TWO_FACTOR_CHALLENGE_TTL_MS: 5 * 60 * 1000,
  TWO_FACTOR_MAX_ATTEMPTS: 5,
  /** Failed sign-ins per normalized email or per IP before that dimension locks. */
  LOCKOUT_ATTEMPTS: environment.AUTH_LOCKOUT_ATTEMPTS,
  LOCKOUT_WINDOW_MS: environment.AUTH_LOCKOUT_WINDOW_MS,
} as const;

/** How often the application should remove expired sessions. */
export const SESSION_CLEANUP_INTERVAL_MS = 60 * 60 * 1000;
