export const SERVER = {
  DEFAULT_PORT: 5555,
} as const;

export const MAINTENANCE = {
  INTERVAL_MS: 24 * 60 * 60 * 1000,
} as const;
export const RATE_LIMIT = {
  MAX_REQUESTS: 100,
  WINDOW_MS: 15 * 60 * 1000,
  AUTH_MAX_REQUESTS: 10,
  AUTH_WINDOW_MS: 60 * 1000,
} as const;
export const SECURITY = {
  CSRF_COOKIE_NAME: 'csrf_token',
  CSRF_HEADER_NAME: 'X-CSRF-Token',
  CSRF_TOKEN_BYTES: 32,
  CSRF_COOKIE_MAX_AGE_MS: 24 * 60 * 60 * 1000,
  MAX_JSON_BODY_BYTES: 1024 * 1024,
} as const;

export const LOGGING = {
  LEVELS: ['trace', 'debug', 'info', 'warn', 'error', 'fatal'] as const,
  ROTATED_FILE_LIMIT: 30,
} as const;
