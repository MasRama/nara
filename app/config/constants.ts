export const SERVER = {
  MAX_BODY_SIZE: 10 * 1024 * 1024,
  DEFAULT_PORT: 5555,
  DEFAULT_VITE_PORT: 5173,
} as const;

export const AUTH = {
  SESSION_EXPIRY_MS: 30 * 24 * 60 * 60 * 1000,
  ERROR_COOKIE_EXPIRY_MS: 5 * 60 * 1000,
} as const;

export const RATE_LIMIT = {
  MAX_REQUESTS: 100,
  WINDOW_MS: 15 * 60 * 1000,
  MAX_LOGIN_ATTEMPTS: 5,
  LOGIN_LOCKOUT_MS: 15 * 60 * 1000,
} as const;

export const UPLOAD = {
  MAX_FILE_SIZE: 5 * 1024 * 1024,
  AVATAR_DIR: 'avatars',
} as const;

export const CACHE = {
  ASSET_STORE_MAX_ENTRIES: 100,
  ASSET_STORE_MAX_BYTES: 20 * 1024 * 1024,
  ASSET_STORE_TTL_MS: 60 * 60 * 1000,
  TEMPLATE_STORE_MAX_ENTRIES: 20,
  TEMPLATE_STORE_TTL_MS: 30 * 60 * 1000,
} as const;

export const LOGGING = {
  LEVELS: ['trace', 'debug', 'info', 'warn', 'error', 'fatal'] as const,
  DEFAULT_LEVEL: 'info',
  LOG_DIR: 'logs',
  MAX_LOG_SIZE: 10 * 1024 * 1024,
  MAX_LOG_FILES: 10,
} as const;

export const DATABASE = {
  DEFAULT_CONNECTION: 'development',
} as const;

export const ERROR_MESSAGES = {
  INVALID_CREDENTIALS: 'Email atau password salah',
  EMAIL_EXISTS: 'Email sudah digunakan',
} as const;
