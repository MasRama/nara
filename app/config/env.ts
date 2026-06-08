import { existsSync } from 'fs';
import { join } from 'path';
import { SERVER, DATABASE, LOGGING } from './constants';

function loadEnvironmentFiles(): void {
  const projectRoot = process.cwd();
  const prodEnvPath = join(projectRoot, '.env.production');
  const devEnvPath = join(projectRoot, '.env');
  
  const hasProdEnv = existsSync(prodEnvPath);
  
  if (hasProdEnv) {
    require('dotenv').config({ path: prodEnvPath });
    process.env.NODE_ENV = 'production';
  } else {
    require('dotenv').config({ path: devEnvPath });
    process.env.NODE_ENV = process.env.NODE_ENV || 'development';
  }
}

loadEnvironmentFiles();

export interface Env {
  NODE_ENV: 'development' | 'production' | 'test';
  PORT: number;
  VITE_PORT: number;
  APP_URL: string;
  HAS_CERTIFICATE: 'true' | 'false';
  
  DB_CONNECTION: string;
  
  LOG_LEVEL: typeof LOGGING.LEVELS[number];
  
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  GOOGLE_REDIRECT_URI?: string;
  
  BACKUP_ENCRYPTION_KEY?: string;
  BACKUP_RETENTION_DAYS: number;
}

export function validateEnv(): Env {
  const errors: string[] = [];
  const env = process.env;

  const validNodeEnvs = ['development', 'production', 'test'] as const;
  const nodeEnv = env.NODE_ENV || 'development';
  if (!validNodeEnvs.includes(nodeEnv as any)) {
    errors.push(`  - NODE_ENV: Must be one of ${validNodeEnvs.join(', ')}`);
  }

  const port = parseInt(env.PORT || String(SERVER.DEFAULT_PORT), 10);
  if (isNaN(port) || port <= 0) {
    errors.push('  - PORT: Must be a positive number');
  }

  const vitePort = parseInt(env.VITE_PORT || String(SERVER.DEFAULT_VITE_PORT), 10);
  if (isNaN(vitePort) || vitePort <= 0) {
    errors.push('  - VITE_PORT: Must be a positive number');
  }

  const logLevel = env.LOG_LEVEL || 'info';
  if (!LOGGING.LEVELS.includes(logLevel as any)) {
    errors.push(`  - LOG_LEVEL: Must be one of ${LOGGING.LEVELS.join(', ')}`);
  }

  const hasCert = env.HAS_CERTIFICATE || 'false';
  if (hasCert !== 'true' && hasCert !== 'false') {
    errors.push('  - HAS_CERTIFICATE: Must be "true" or "false"');
  }

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
    BACKUP_ENCRYPTION_KEY: env.BACKUP_ENCRYPTION_KEY || undefined,
    BACKUP_RETENTION_DAYS: backupDays,
  };
}

export function checkFeatureConfig(env: Env) {
  const warnings: string[] = [];
  
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
    warnings.push('Google OAuth not configured (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET)');
  }
  
  if (!env.BACKUP_ENCRYPTION_KEY) {
    warnings.push('Backup encryption not configured (BACKUP_ENCRYPTION_KEY)');
  }
  
  return warnings;
}

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
      backup: !!env.BACKUP_ENCRYPTION_KEY,
    },
  };
}

let _env: Env | null = null;

export function getEnv(): Env {
  if (!_env) {
    _env = validateEnv();
  }
  return _env;
}

export function initEnv(): Env {
  return getEnv();
}
