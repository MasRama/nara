import fs from 'node:fs';
import path from 'node:path';
import pino from 'pino';
import { env } from '../config';

type LogData = Record<string, unknown>;
type LogError = Error | LogData;

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
      },
    },
  ],
});

const logger = pino(
  {
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
  },
  transport,
);

export const trace = (message: string, data?: LogData): void => {
  if (data) logger.trace(data, message);
  else logger.trace(message);
};

export const debug = (message: string, data?: LogData): void => {
  if (data) logger.debug(data, message);
  else logger.debug(message);
};

export const info = (message: string, data?: LogData): void => {
  if (data) logger.info(data, message);
  else logger.info(message);
};

export const warn = (message: string, data?: LogData): void => {
  if (data) logger.warn(data, message);
  else logger.warn(message);
};

export const error = (message: string, data?: LogError): void => {
  if (data instanceof Error) logger.error({ err: data }, message);
  else if (data) logger.error(data, message);
  else logger.error(message);
};

export const fatal = (message: string, data?: LogError): void => {
  if (data instanceof Error) logger.fatal({ err: data }, message);
  else if (data) logger.fatal(data, message);
  else logger.fatal(message);
};

export const logRequest = (data: {
  method: string;
  url: string;
  statusCode?: number;
  responseTime?: number;
  userId?: string;
  ip?: string;
}): void => {
  info('HTTP request', data);
};

export const logAuth = (event: string, data: LogData): void => {
  info(`Auth: ${event}`, data);
};

export const logSecurity = (event: string, data: LogData): void => {
  warn(`Security: ${event}`, data);
};

export const flush = async (): Promise<void> => {
  await new Promise<void>((resolve, reject) => {
    logger.flush((error) => {
      if (error) reject(error);
      else resolve();
    });
  });
};

export const Logger = { trace, debug, info, warn, error, fatal, logRequest, logAuth, logSecurity, flush };
export default Logger;
