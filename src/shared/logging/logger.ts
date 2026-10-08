import fs from 'node:fs';
import path from 'node:path';
import pino from 'pino';
import { env, LOGGING } from '../config';
import { errorOriginFeature, featureFromStack } from './feature-origin';

type LogData = Record<string, unknown>;
type LogError = Error | LogData;

function createLogger() {
  if (env.NODE_ENV === 'test') return pino({ enabled: false });

  const logsDirectory = path.join(process.cwd(), 'logs');
  if (!fs.existsSync(logsDirectory)) {
    fs.mkdirSync(logsDirectory, { recursive: true });
  }

  const prettyConsole =
    env.LOG_PRETTY === 'true' ||
    (env.LOG_PRETTY !== 'false' && (env.NODE_ENV === 'development' || process.stdout.isTTY));

  const transport = pino.transport({
    targets: [
      prettyConsole
        ? {
            target: 'pino-pretty',
            level: env.LOG_LEVEL,
            options: {
              colorize: true,
              translateTime: 'HH:MM:ss',
              ignore: 'pid,hostname',
              messageFormat: '{msg}',
            },
          }
        : {
            target: 'pino/file',
            level: env.LOG_LEVEL,
            options: { destination: 1 },
          },
      {
        target: 'pino-roll',
        level: env.LOG_LEVEL,
        options: {
          file: path.join(logsDirectory, 'app.log'),
          frequency: 'daily',
          size: '10m',
          mkdir: true,
          extension: '.log',
          limit: { count: LOGGING.ROTATED_FILE_LIMIT, removeOtherLogFiles: true },
        },
      },
      {
        target: 'pino-roll',
        level: 'error',
        options: {
          file: path.join(logsDirectory, 'error.log'),
          frequency: 'daily',
          size: '10m',
          mkdir: true,
          extension: '.log',
          limit: { count: LOGGING.ROTATED_FILE_LIMIT, removeOtherLogFiles: true },
        },
      },
    ],
  });

  return pino({
    level: env.LOG_LEVEL,
    base: { env: env.NODE_ENV, pid: process.pid },
    timestamp: pino.stdTimeFunctions.isoTime,
    redact: {
      paths: [
        'password',
        'token',
        'authorization',
        'cookie',
        'req.headers.authorization',
        'req.headers.cookie',
      ],
      censor: '[REDACTED]',
    },
  }, transport);
}

const logger = createLogger();

/**
 * Warn and above carry the owning Feature: an explicit `feature` key wins
 * (even when undefined), then the logged error's origin, then the innermost
 * Feature on the call stack. Info stays untagged so the hot path never
 * captures a stack.
 */
function withFeature(data: LogData | undefined, loggedError?: unknown): LogData {
  if (data && 'feature' in data) return data;
  const feature = errorOriginFeature(loggedError) ?? featureFromStack(new Error().stack);
  return feature ? { ...data, feature } : { ...data };
}

function errorData(data: LogError | undefined): LogData {
  if (data instanceof Error) return withFeature({ err: data }, data);
  return withFeature(data, data?.err);
}

const info = (message: string, data?: LogData): void => {
  if (data) logger.info(data, message);
  else logger.info(message);
};

const warn = (message: string, data?: LogData): void => {
  logger.warn(withFeature(data), message);
};

const error = (message: string, data?: LogError): void => {
  logger.error(errorData(data), message);
};

const fatal = (message: string, data?: LogError): void => {
  logger.fatal(errorData(data), message);
};

const logAuth = (event: string, data: LogData): void => {
  info(`Auth: ${event}`, data);
};

const logSecurity = (event: string, data: LogData): void => {
  warn(`Security: ${event}`, data);
};

const flush = async (): Promise<void> => {
  await new Promise<void>((resolve, reject) => {
    logger.flush((error) => {
      if (error) reject(error);
      else resolve();
    });
  });
};

export const Logger = { info, warn, error, fatal, logAuth, logSecurity, flush };
