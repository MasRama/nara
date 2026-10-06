import fs from 'node:fs';
import path from 'node:path';
import pino from 'pino';
import { env, LOGGING } from '../config';

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

const info = (message: string, data?: LogData): void => {
  if (data) logger.info(data, message);
  else logger.info(message);
};

const warn = (message: string, data?: LogData): void => {
  if (data) logger.warn(data, message);
  else logger.warn(message);
};

const error = (message: string, data?: LogError): void => {
  if (data instanceof Error) logger.error({ err: data }, message);
  else if (data) logger.error(data, message);
  else logger.error(message);
};

const fatal = (message: string, data?: LogError): void => {
  if (data instanceof Error) logger.fatal({ err: data }, message);
  else if (data) logger.fatal(data, message);
  else logger.fatal(message);
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
