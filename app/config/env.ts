import { existsSync } from 'fs';
import { join } from 'path';
import { z } from 'zod';
import { SERVER, LOGGING } from './constants';

const projectRoot = process.cwd();
const prodEnvPath = join(projectRoot, '.env.production');

if (existsSync(prodEnvPath)) {
  require('dotenv').config({ path: prodEnvPath });
  process.env.NODE_ENV = 'production';
} else {
  require('dotenv').config({ path: '.env' });
  process.env.NODE_ENV = process.env.NODE_ENV || 'development';
}

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(SERVER.DEFAULT_PORT),
  VITE_PORT: z.coerce.number().int().positive().default(SERVER.DEFAULT_VITE_PORT),
  APP_URL: z.string().default(`http://localhost:${process.env.PORT || SERVER.DEFAULT_PORT}`),
  HAS_CERTIFICATE: z.enum(['true', 'false']).default('false'),
  DB_CONNECTION: z.string().default('development'),
  LOG_LEVEL: z.enum(LOGGING.LEVELS).default('info'),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_REDIRECT_URI: z.string().optional(),
  BACKUP_ENCRYPTION_KEY: z.string().optional(),
  BACKUP_RETENTION_DAYS: z.coerce.number().int().positive().default(30),
});

export type Env = z.infer<typeof EnvSchema>;

const parsed = EnvSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('\n❌ Environment validation failed:\n');
  for (const issue of parsed.error.issues) {
    console.error(`  - ${issue.path.join('.')}: ${issue.message}`);
  }
  console.error('\nPlease check your .env file and ensure all required variables are set.\n');
  process.exit(1);
}

export const env: Env = parsed.data;

export function checkFeatureConfig(envConfig: Env): string[] {
  const warnings: string[] = [];
  if (!envConfig.GOOGLE_CLIENT_ID || !envConfig.GOOGLE_CLIENT_SECRET) {
    warnings.push('Google OAuth not configured (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET)');
  }
  if (!envConfig.BACKUP_ENCRYPTION_KEY) {
    warnings.push('Backup encryption not configured (BACKUP_ENCRYPTION_KEY)');
  }
  return warnings;
}

export function getEnvSummary(envConfig: Env) {
  return {
    nodeEnv: envConfig.NODE_ENV,
    port: envConfig.PORT,
    appUrl: envConfig.APP_URL,
    dbConnection: envConfig.DB_CONNECTION,
    logLevel: envConfig.LOG_LEVEL,
    hasHttps: envConfig.HAS_CERTIFICATE === 'true',
    features: {
      googleOAuth: !!(envConfig.GOOGLE_CLIENT_ID && envConfig.GOOGLE_CLIENT_SECRET),
      backup: !!envConfig.BACKUP_ENCRYPTION_KEY,
    },
  };
}

export const initEnv = (): Env => env;
