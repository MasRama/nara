/**
 * Environment Configuration & Validation
 * 
 * Validates required environment variables on application startup.
 * Provides typed access to environment configuration.
 * No external dependencies - just plain TypeScript.
 */
import { SERVER, DATABASE, LOGGING } from './constants';

// ============================================
// Type Definitions
// ============================================

export interface Env {
  // Server
  NODE_ENV: 'development' | 'production' | 'test';
  PORT: number;
  VITE_PORT: number;
  APP_URL: string;
  HAS_CERTIFICATE: 'true' | 'false';
  
  // Database
  DB_CONNECTION: string;
  
  // Logging
  LOG_LEVEL: typeof LOGGING.LEVELS[number];
  
  // Google OAuth (optional)
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  GOOGLE_REDIRECT_URI?: string;
  
  // Mailer (optional)
  USER_MAILER?: string;
  PASS_MAILER?: string;
  
  // SMS Provider (optional)
  DRIPSENDER_API_KEY?: string;
  
  // Backup (optional)
  BACKUP_ENCRYPTION_KEY?: string;
  BACKUP_RETENTION_DAYS: number;
}

// ============================================
// Validation Function
// ============================================

/**
 * Validate environment variables
 * @returns Validated and typed environment object
 * @throws Error if validation fails
 */
export function validateEnv(): Env {
  const errors: string[] = [];
  const env = process.env;

  // Validate NODE_ENV
  const validNodeEnvs = ['development', 'production', 'test'] as const;
  const nodeEnv = env.NODE_ENV || 'development';
  if (!validNodeEnvs.includes(nodeEnv as any)) {
    errors.push(`  - NODE_ENV: Must be one of ${validNodeEnvs.join(', ')}`);
  }

  // Validate PORT
  const port = parseInt(env.PORT || String(SERVER.DEFAULT_PORT), 10);
  if (isNaN(port) || port <= 0) {
    errors.push('  - PORT: Must be a positive number');
  }

  // Validate VITE_PORT
  const vitePort = parseInt(env.VITE_PORT || String(SERVER.DEFAULT_VITE_PORT), 10);
  if (isNaN(vitePort) || vitePort <= 0) {
    errors.push('  - VITE_PORT: Must be a positive number');
  }

  // Validate LOG_LEVEL
  const logLevel = env.LOG_LEVEL || 'info';
  if (!LOGGING.LEVELS.includes(logLevel as any)) {
    errors.push(`  - LOG_LEVEL: Must be one of ${LOGGING.LEVELS.join(', ')}`);
  }

  // Validate HAS_CERTIFICATE
  const hasCert = env.HAS_CERTIFICATE || 'false';
  if (hasCert !== 'true' && hasCert !== 'false') {
    errors.push('  - HAS_CERTIFICATE: Must be "true" or "false"');
  }

  // Validate BACKUP_RETENTION_DAYS
  const backupDays = parseInt(env.BACKUP_RETENTION_DAYS || '30', 10);
  if (isNaN(backupDays) || backupDays <= 0) {
    errors.push('  - BACKUP_RETENTION_DAYS: Must be a positive number');
  }

  if (errors.length > 0) {
    console.error('\n❌ Environment validation failed:\n');
    console.error(errors.join('\n'));
    console.error('\nPlease check your .env file and ensure all required variables are set.\n');
    process.exit(1);
  }

  return {
    NODE_ENV: nodeEnv as 'development' | 'production' | 'test',
    PORT: port,
    VITE_PORT: vitePort,
    APP_URL: env.APP_URL || `http://localhost:${port}`,
    HAS_CERTIFICATE: hasCert as 'true' | 'false',
    DB_CONNECTION: env.DB_CONNECTION || DATABASE.DEFAULT_CONNECTION,
    LOG_LEVEL: logLevel as typeof LOGGING.LEVELS[number],
    GOOGLE_CLIENT_ID: env.GOOGLE_CLIENT_ID || undefined,
    GOOGLE_CLIENT_SECRET: env.GOOGLE_CLIENT_SECRET || undefined,
    GOOGLE_REDIRECT_URI: env.GOOGLE_REDIRECT_URI || undefined,
    USER_MAILER: env.USER_MAILER || undefined,
    PASS_MAILER: env.PASS_MAILER || undefined,
    DRIPSENDER_API_KEY: env.DRIPSENDER_API_KEY || undefined,
    BACKUP_ENCRYPTION_KEY: env.BACKUP_ENCRYPTION_KEY || undefined,
    BACKUP_RETENTION_DAYS: backupDays,
  };
}

/**
 * Check if specific features are configured
 */
export function checkFeatureConfig(env: Env) {
  const warnings: string[] = [];
  
  // Check Google OAuth (empty string counts as not configured)
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
    warnings.push('Google OAuth not configured (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET)');
  }
  
  // Check Mailer (empty string counts as not configured)
  if (!env.USER_MAILER || !env.PASS_MAILER) {
    warnings.push('Email service not configured (USER_MAILER, PASS_MAILER)');
  }
  
  // Check SMS
  if (!env.DRIPSENDER_API_KEY) {
    warnings.push('SMS service not configured (DRIPSENDER_API_KEY)');
  }
  
  // Check Backup
  if (!env.BACKUP_ENCRYPTION_KEY) {
    warnings.push('Backup encryption not configured (BACKUP_ENCRYPTION_KEY)');
  }
  
  return warnings;
}

/**
 * Get environment summary for logging
 */
export function getEnvSummary(env: Env) {
  return {
    nodeEnv: env.NODE_ENV,
    port: env.PORT,
    appUrl: env.APP_URL,
    dbConnection: env.DB_CONNECTION,
    logLevel: env.LOG_LEVEL,
    hasHttps: env.HAS_CERTIFICATE === 'true',
    features: {
      googleOAuth: !!(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET),
      email: !!(env.USER_MAILER && env.PASS_MAILER),
      sms: !!env.DRIPSENDER_API_KEY,
      backup: !!env.BACKUP_ENCRYPTION_KEY,
    },
  };
}

// ============================================
// Singleton Instance
// ============================================

let _env: Env | null = null;

/**
 * Get validated environment (lazy initialization)
 */
export function getEnv(): Env {
  if (!_env) {
    _env = validateEnv();
  }
  return _env;
}

/**
 * Initialize environment validation
 * Call this at application startup
 */
export function initEnv(): Env {
  require('dotenv').config();
  return getEnv();
}
