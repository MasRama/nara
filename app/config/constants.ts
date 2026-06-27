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
  ALLOWED_MIME_TYPES: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'] as string[],
};

export const CACHE = {
  ASSET_STORE_MAX_ENTRIES: 100,
  ASSET_STORE_MAX_BYTES: 20 * 1024 * 1024,
  ASSET_STORE_TTL_MS: 60 * 60 * 1000,
  TEMPLATE_STORE_MAX_ENTRIES: 20,
  TEMPLATE_STORE_TTL_MS: 30 * 60 * 1000,
} as const;

export const LOGGING = {
  LEVELS: ['trace', 'debug', 'info', 'warn', 'error', 'fatal'] as const,
} as const;
