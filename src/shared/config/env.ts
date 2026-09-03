import { existsSync } from 'node:fs';
import { join } from 'node:path';
import dotenv from 'dotenv';
import { z } from 'zod';
import { LOGGING, SERVER } from './constants';

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(SERVER.DEFAULT_PORT),
  VITE_PORT: z.coerce.number().int().positive().default(SERVER.DEFAULT_VITE_PORT),
  APP_URL: z.string().optional(),
  LOG_LEVEL: z.enum(LOGGING.LEVELS).default('debug'),
  DB_FILE: z.string().min(1).optional(),
  LOG_PRETTY: z.enum(['true', 'false']).optional(),
});

type ParsedEnv = z.infer<typeof EnvSchema>;
export type Env = Omit<ParsedEnv, 'APP_URL'> & { APP_URL: string };

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

  return {
    ...parsed.data,
    APP_URL: parsed.data.APP_URL?.trim() || `http://localhost:${parsed.data.VITE_PORT}`,
  };
}

export function loadEnvFile(): void {
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

export function getEnvSummary(envConfig: Env) {
  return {
    nodeEnv: envConfig.NODE_ENV,
    port: envConfig.PORT,
    appUrl: envConfig.APP_URL,
    logLevel: envConfig.LOG_LEVEL,
  };
}
