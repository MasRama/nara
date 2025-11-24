/**
 * Environment Configuration & Validation
 * 
 * Validates required environment variables on application startup.
 * Provides typed access to environment configuration.
 */
import { z } from 'zod';
import { SERVER, DATABASE, LOGGING } from './constants';

// ============================================
// Environment Schema
// ============================================

const EnvSchema = z.object({
  // Server
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(SERVER.DEFAULT_PORT),
  VITE_PORT: z.coerce.number().int().positive().default(SERVER.DEFAULT_VITE_PORT),
  APP_URL: z.string().url().default(`http://localhost:${SERVER.DEFAULT_PORT}`),
  HAS_CERTIFICATE: z.enum(['true', 'false']).default('false'),
  
  // Database
  DB_CONNECTION: z.string().default(DATABASE.DEFAULT_CONNECTION),
  
  // Logging
  LOG_LEVEL: z.enum(LOGGING.LEVELS).default('info'),
  
  // Google OAuth (optional)
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_REDIRECT_URI: z.string().url().optional(),
  
  // Mailer (optional)
  USER_MAILER: z.string().email().optional(),
  PASS_MAILER: z.string().optional(),
  
  // SMS Provider (optional)
  DRIPSENDER_API_KEY: z.string().optional(),
  
  // Backup (optional)
  BACKUP_ENCRYPTION_KEY: z.string().min(32).optional(),
  BACKUP_RETENTION_DAYS: z.coerce.number().int().positive().default(30),
});

// ============================================
// Type Exports
// ============================================

export type Env = z.infer<typeof EnvSchema>;

// ============================================
// Validation Function
// ============================================

/**
 * Validate environment variables
 * @returns Validated and typed environment object
 * @throws Error if validation fails
 */
export function validateEnv(): Env {
  const result = EnvSchema.safeParse(process.env);
  
  if (!result.success) {
    const errors = result.error.issues.map(issue => {
      const path = issue.path.join('.');
      return `  - ${path}: ${issue.message}`;
    });
    
    console.error('\n❌ Environment validation failed:\n');
    console.error(errors.join('\n'));
    console.error('\nPlease check your .env file and ensure all required variables are set.\n');
    
    process.exit(1);
  }
  
  return result.data;
}

/**
 * Check if specific features are configured
 */
export function checkFeatureConfig(env: Env) {
  const warnings: string[] = [];
  
  // Check Google OAuth
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
    warnings.push('Google OAuth not configured (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET)');
  }
  
  // Check Mailer
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
