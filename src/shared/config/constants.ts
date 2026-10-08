export const SERVER = {
  DEFAULT_PORT: 5555,
} as const;
export const AUTH = {
  SESSION_EXPIRY_MS: 60 * 24 * 60 * 60 * 1000,
  SESSION_CLEANUP_INTERVAL_MS: 60 * 60 * 1000,
  /** Oldest sessions beyond this per-account cap are revoked on sign-in. */
  MAX_SESSIONS_PER_USER: 10,
  /** last_seen_at is written at most once per interval per session. */
  SESSION_TOUCH_INTERVAL_MS: 5 * 60 * 1000,
  TWO_FACTOR_ISSUER: 'Nara',
  TWO_FACTOR_CHALLENGE_TTL_MS: 5 * 60 * 1000,
  TWO_FACTOR_MAX_ATTEMPTS: 5,
} as const;

export const MAINTENANCE = {
  INTERVAL_MS: 24 * 60 * 60 * 1000,
  ACTIVITY_RETENTION_DAYS: 365,
  ACTIVITY_PRUNE_LIMIT: 10_000,
} as const;
export const RATE_LIMIT = {
  MAX_REQUESTS: 100,
  WINDOW_MS: 15 * 60 * 1000,
  AUTH_MAX_REQUESTS: 10,
  AUTH_WINDOW_MS: 60 * 1000,
  MAX_LOGIN_ATTEMPTS: 5,
  LOGIN_LOCKOUT_MS: 15 * 60 * 1000,
} as const;
export const SECURITY = {
  CSRF_COOKIE_NAME: 'csrf_token',
  CSRF_HEADER_NAME: 'X-CSRF-Token',
  CSRF_TOKEN_BYTES: 32,
  CSRF_COOKIE_MAX_AGE_MS: 24 * 60 * 60 * 1000,
  MAX_JSON_BODY_BYTES: 1024 * 1024,
} as const;
export const UPLOAD = {
  MAX_FILE_SIZE: 5 * 1024 * 1024,
  AVATAR_DIR: 'avatars',
  ALLOWED_MIME_TYPES: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'] as const,
} as const;

export const LOGGING = {
  LEVELS: ['trace', 'debug', 'info', 'warn', 'error', 'fatal'] as const,
  ROTATED_FILE_LIMIT: 30,
} as const;
