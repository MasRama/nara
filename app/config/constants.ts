/**
 * Application Constants
 * 
 * Centralized configuration values to avoid magic numbers/strings
 * scattered throughout the codebase.
 */

// ============================================
// Server Configuration
// ============================================

export const SERVER = {
  /** Maximum request body size in bytes (10MB) */
  MAX_BODY_SIZE: 10 * 1024 * 1024,
  
  /** Default server port */
  DEFAULT_PORT: 5555,
  
  /** Default Vite dev server port */
  DEFAULT_VITE_PORT: 5173,
} as const;

// ============================================
// Authentication & Security
// ============================================

export const AUTH = {
  /** Token expiry duration in hours */
  TOKEN_EXPIRY_HOURS: 24,
  
  /** Session cookie expiry in milliseconds (30 days) */
  SESSION_EXPIRY_MS: 30 * 24 * 60 * 60 * 1000,
  
  /** Error cookie expiry in milliseconds (5 minutes) */
  ERROR_COOKIE_EXPIRY_MS: 5 * 60 * 1000,
  
  /** Minimum password length */
  MIN_PASSWORD_LENGTH: 8,
  
  /** Maximum password length */
  MAX_PASSWORD_LENGTH: 100,
  
  /** Bcrypt salt rounds */
  BCRYPT_SALT_ROUNDS: 10,
} as const;

// ============================================
// Pagination
// ============================================

export const PAGINATION = {
  /** Default page size */
  DEFAULT_PAGE_SIZE: 10,
  
  /** Maximum page size allowed */
  MAX_PAGE_SIZE: 100,
  
  /** Default page number */
  DEFAULT_PAGE: 1,
} as const;

// ============================================
// User & Profile
// ============================================

export const USER = {
  /** Minimum name length */
  MIN_NAME_LENGTH: 2,
  
  /** Maximum name length */
  MAX_NAME_LENGTH: 100,
  
  /** Minimum phone length */
  MIN_PHONE_LENGTH: 10,
  
  /** Maximum phone length */
  MAX_PHONE_LENGTH: 20,
} as const;

// ============================================
// File Upload
// ============================================

export const UPLOAD = {
  /** Maximum file size in bytes (5MB) */
  MAX_FILE_SIZE: 5 * 1024 * 1024,
  
  /** Allowed image extensions */
  ALLOWED_IMAGE_EXTENSIONS: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'],
  
  /** Allowed document extensions */
  ALLOWED_DOC_EXTENSIONS: ['pdf', 'doc', 'docx', 'xls', 'xlsx'],
  
  /** Avatar upload directory */
  AVATAR_DIR: 'public/uploads/avatars',
  
  /** General assets directory */
  ASSETS_DIR: 'public/uploads/assets',
} as const;

// ============================================
// Cache & Performance
// ============================================

export const CACHE = {
  /** Static asset cache duration in seconds (1 year) */
  STATIC_ASSET_MAX_AGE: 365 * 24 * 60 * 60,
  
  /** API response cache duration in seconds (5 minutes) */
  API_CACHE_DURATION: 5 * 60,
  
  /** Session cache duration in seconds (1 hour) */
  SESSION_CACHE_DURATION: 60 * 60,
} as const;

// ============================================
// Rate Limiting
// ============================================

export const RATE_LIMIT = {
  /** Maximum requests per window (general) */
  MAX_REQUESTS: 100,
  
  /** Window duration in milliseconds (15 minutes) */
  WINDOW_MS: 15 * 60 * 1000,
  
  /** Login attempts before lockout */
  MAX_LOGIN_ATTEMPTS: 5,
  
  /** Login lockout duration in milliseconds (15 minutes) */
  LOGIN_LOCKOUT_MS: 15 * 60 * 1000,
  
  /** API rate limit (requests per minute) */
  API_MAX_REQUESTS: 60,
  
  /** API rate limit window (1 minute) */
  API_WINDOW_MS: 60 * 1000,
  
  /** Strict rate limit for sensitive endpoints */
  STRICT_MAX_REQUESTS: 10,
  
  /** Strict rate limit window (1 minute) */
  STRICT_WINDOW_MS: 60 * 1000,
} as const;

// ============================================
// Security Headers
// ============================================

export const SECURITY = {
  /** HSTS max-age in seconds (1 year) */
  HSTS_MAX_AGE: 365 * 24 * 60 * 60,
  
  /** CSRF token length in bytes */
  CSRF_TOKEN_LENGTH: 32,
  
  /** CSRF cookie max age in seconds (24 hours) */
  CSRF_COOKIE_MAX_AGE: 24 * 60 * 60,
  
  /** CSRF cookie name */
  CSRF_COOKIE_NAME: 'csrf_token',
  
  /** CSRF header name */
  CSRF_HEADER_NAME: 'X-CSRF-Token',
} as const;

// ============================================
// Database
// ============================================

export const DATABASE = {
  /** Default connection type */
  DEFAULT_CONNECTION: 'development',
  
  /** Connection pool min */
  POOL_MIN: 2,
  
  /** Connection pool max */
  POOL_MAX: 10,
} as const;

// ============================================
// Logging
// ============================================

export const LOGGING = {
  /** Available log levels */
  LEVELS: ['trace', 'debug', 'info', 'warn', 'error', 'fatal'] as const,
  
  /** Default log level */
  DEFAULT_LEVEL: 'info',
  
  /** Log file directory */
  LOG_DIR: 'logs',
  
  /** Max log file size in bytes (10MB) */
  MAX_LOG_SIZE: 10 * 1024 * 1024,
  
  /** Number of log files to keep */
  MAX_LOG_FILES: 10,
} as const;

// ============================================
// HTTP Status Codes (commonly used)
// ============================================

export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
} as const;

// ============================================
// Error Messages
// ============================================

export const ERROR_MESSAGES = {
  UNAUTHORIZED: 'Unauthorized',
  FORBIDDEN: 'Akses ditolak',
  NOT_FOUND: 'Data tidak ditemukan',
  VALIDATION_FAILED: 'Validasi gagal',
  INTERNAL_ERROR: 'Terjadi kesalahan internal',
  INVALID_CREDENTIALS: 'Email atau password salah',
  EMAIL_EXISTS: 'Email sudah digunakan',
  TOKEN_EXPIRED: 'Link tidak valid atau sudah kadaluarsa',
  SESSION_EXPIRED: 'Sesi telah berakhir, silakan login kembali',
} as const;

// ============================================
// Success Messages
// ============================================

export const SUCCESS_MESSAGES = {
  USER_CREATED: 'User berhasil dibuat',
  USER_UPDATED: 'User berhasil diupdate',
  USER_DELETED: 'User berhasil dihapus',
  PROFILE_UPDATED: 'Profil berhasil diupdate',
  PASSWORD_CHANGED: 'Password berhasil diubah',
  PASSWORD_RESET_SENT: 'Link reset password telah dikirim',
  LOGIN_SUCCESS: 'Login berhasil',
  LOGOUT_SUCCESS: 'Logout berhasil',
} as const;
