/**
 * Environment Configuration & Validation
 *
 * Validates required environment variables on application startup.
 * Provides typed access to environment configuration.
 */
import { SERVER, LOGGING } from './constants.js';

// ============================================
// Type Definitions
// ============================================

export interface Env {
  // Server
  NODE_ENV: 'development' | 'production' | 'test';
  PORT: number;
  APP_URL: string;

  // Database
  DB_CONNECTION: string;

  // Auth
  JWT_SECRET: string;

  // Logging
  LOG_LEVEL: typeof LOGGING.LEVELS[number];
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

  // Validate LOG_LEVEL
  const logLevel = env.LOG_LEVEL || 'info';
  if (!LOGGING.LEVELS.includes(logLevel as any)) {
    errors.push(`  - LOG_LEVEL: Must be one of ${LOGGING.LEVELS.join(', ')}`);
  }

  // Warning for missing JWT_SECRET in production
  if (nodeEnv === 'production' && !env.JWT_SECRET) {
    errors.push('  - JWT_SECRET: Required in production');
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
    APP_URL: env.APP_URL || `http://localhost:${port}`,
    DB_CONNECTION: env.DB_CONNECTION || 'development',
    JWT_SECRET: env.JWT_SECRET || 'your-secret-key',
    LOG_LEVEL: logLevel as typeof LOGGING.LEVELS[number],
  };
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
