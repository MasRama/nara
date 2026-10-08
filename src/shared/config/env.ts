import { existsSync } from 'node:fs';
import { join } from 'node:path';
import dotenv from 'dotenv';
import { z } from 'zod';

import { LOGGING, RATE_LIMIT, SECURITY, SERVER } from './constants';

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(SERVER.DEFAULT_PORT),
  APP_URL: z.string().optional(),
  LOG_LEVEL: z.enum(LOGGING.LEVELS).default('debug'),
  DB_FILE: z.string().min(1).optional(),
  LOG_PRETTY: z.enum(['true', 'false']).optional(),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(RATE_LIMIT.MAX_REQUESTS),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(RATE_LIMIT.WINDOW_MS),
  AUTH_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(RATE_LIMIT.AUTH_MAX_REQUESTS),
  AUTH_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(RATE_LIMIT.AUTH_WINDOW_MS),
  MAX_JSON_BODY_BYTES: z.coerce.number().int().positive().default(SECURITY.MAX_JSON_BODY_BYTES),
  TRUST_PROXY: z.enum(['true', 'false']).default('false'),
  TRUST_PROXY_HOPS: z.coerce.number().int().min(1).max(10).default(1),
});

type ParsedEnv = z.infer<typeof EnvSchema>;
type Env = Omit<ParsedEnv, 'APP_URL'> & { APP_URL: string };

function formatIssues(error: z.ZodError): string {
  return error.issues
    .map((issue) => `  - ${issue.path.join('.') || '_root'}: ${issue.message}`)
    .join('\n');
}

export function parseEnv(input: NodeJS.ProcessEnv): Env {
  const parsed = EnvSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(`Environment validation failed:\n${formatIssues(parsed.error)}`);
  }

  if (parsed.data.NODE_ENV === 'production' && !input.APP_URL?.trim()) {
    throw new Error('Environment validation failed:\n  - APP_URL: required in production');
  }

  // Operational default: production stays at info unless explicitly
  // overridden; development keeps the verbose debug default. No redundant
  // logging variables.
  const explicitLogLevel = input.LOG_LEVEL?.trim();
  const logLevel =
    explicitLogLevel ? parsed.data.LOG_LEVEL : parsed.data.NODE_ENV === 'production' ? 'info' : parsed.data.LOG_LEVEL;

  return {
    ...parsed.data,
    LOG_LEVEL: logLevel,
    APP_URL: parsed.data.APP_URL?.trim() || `http://localhost:${parsed.data.PORT}`,
  };
}

function loadEnvFile(): void {
  const productionPath = join(process.cwd(), '.env.production');
  if (existsSync(productionPath)) {
    dotenv.config({ path: productionPath });
    process.env.NODE_ENV = 'production';
    return;
  }

  dotenv.config({ path: join(process.cwd(), '.env') });
  process.env.NODE_ENV ??= 'development';
}

loadEnvFile();

export const env = parseEnv(process.env);

/** Who reads each environment variable: `core` for the schema above, otherwise the owning Feature. */
const environmentOwners = new Map<string, string>(Object.keys(EnvSchema.shape).map((key) => [key, 'core']));

/**
 * Validates the environment variables one Feature owns. Feature server
 * modules call this at import time, so a bad value stops the application at
 * boot with the owning Feature named. Two owners reading the same variable is
 * an error as well: each variable has exactly one owner.
 */
export function readFeatureEnv<Shape extends z.ZodRawShape>(
  feature: string,
  shape: Shape,
): z.infer<z.ZodObject<Shape>> {
  for (const key of Object.keys(shape)) {
    const owner = environmentOwners.get(key);
    if (owner !== undefined && owner !== feature) {
      throw new Error(`Environment variable ${key} is read by both ${owner} and the ${feature} feature`);
    }
  }

  const parsed = z.object(shape).safeParse(process.env);
  if (!parsed.success) {
    throw new Error(`Environment validation failed for the ${feature} feature:\n${formatIssues(parsed.error)}`);
  }

  for (const key of Object.keys(shape)) environmentOwners.set(key, feature);
  return parsed.data;
}

/** Every environment variable read so far, with its owner. */
export function environmentVariables(): ReadonlyMap<string, string> {
  return new Map(environmentOwners);
}
