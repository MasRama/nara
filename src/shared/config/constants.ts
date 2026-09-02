export const SERVER = {
  DEFAULT_PORT: 5555,
  DEFAULT_VITE_PORT: 5173,
} as const;
export const AUTH = {
  SESSION_EXPIRY_MS: 60 * 24 * 60 * 60 * 1000,
} as const;
export const UPLOAD = {
  MAX_FILE_SIZE: 5 * 1024 * 1024,
  AVATAR_DIR: 'avatars',
  ALLOWED_MIME_TYPES: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'] as const,
} as const;

export const LOGGING = {
  LEVELS: ['trace', 'debug', 'info', 'warn', 'error', 'fatal'] as const,
} as const;
