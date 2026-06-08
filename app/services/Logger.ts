
import pino from 'pino';
import path from 'path';
import fs from 'fs';

import '@config';

const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

const LOG_LEVEL = process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug');
const NODE_ENV = process.env.NODE_ENV || 'development';

const usePrettyConsole =
  process.env.LOG_PRETTY === 'true' ||
  (process.env.LOG_PRETTY !== 'false' && (NODE_ENV === 'development' || process.stdout.isTTY));

const pinoConfig: pino.LoggerOptions = {
  level: LOG_LEVEL,
  
  base: {
    env: NODE_ENV,
    pid: process.pid,
  },

  timestamp: () => `,"time":"${new Date().toISOString()}"`,

  serializers: {
    error: pino.stdSerializers.err,
    req: pino.stdSerializers.req,
    res: pino.stdSerializers.res,
  },

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
};

const transport = pino.transport({
  targets: [
    usePrettyConsole
      ? {
          target: 'pino-pretty',
          level: LOG_LEVEL,
          options: {
            colorize: true,
            translateTime: 'HH:MM:ss',
            ignore: 'pid,hostname',
            singleLine: false,
            messageFormat: '{msg}',
          },
        }
      : {
          target: 'pino/file',
          level: LOG_LEVEL,
          options: {
            destination: 1,
          },
        },

    {
      target: 'pino-roll',
      level: LOG_LEVEL,
      options: {
        file: path.join(logsDir, 'app.log'),
        frequency: 'daily',
        size: '10m', // Max 10MB per file
        mkdir: true,
        extension: '.log',
      },
    },

    {
      target: 'pino-roll',
      level: 'error',
      options: {
        file: path.join(logsDir, 'error.log'),
        frequency: 'daily',
        size: '10m',
        mkdir: true,
        extension: '.log',
      },
    },
  ],
});

const logger = pino(pinoConfig, transport);

export const child = (bindings: Record<string, any>): pino.Logger =>
  logger.child(bindings);

export const trace = (message: string, data?: Record<string, any>): void => {
  if (data) logger.trace(data, message);
  else logger.trace(message);
};

export const debug = (message: string, data?: Record<string, any>): void => {
  if (data) logger.debug(data, message);
  else logger.debug(message);
};

export const info = (message: string, data?: Record<string, any>): void => {
  if (data) logger.info(data, message);
  else logger.info(message);
};

export const warn = (message: string, data?: Record<string, any>): void => {
  if (data) logger.warn(data, message);
  else logger.warn(message);
};

export const error = (message: string, err?: Error | Record<string, any>): void => {
  if (err instanceof Error) logger.error({ err }, message);
  else if (err) logger.error(err, message);
  else logger.error(message);
};

export const fatal = (message: string, err?: Error | Record<string, any>): void => {
  if (err instanceof Error) logger.fatal({ err }, message);
  else if (err) logger.fatal(err, message);
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
  info('HTTP Request', data);
};

export const logQuery = (query: string, duration?: number): void => {
  debug('Database Query', { query, duration });
};

export const logAuth = (event: string, data: Record<string, any>): void => {
  info(`Auth: ${event}`, data);
};

export const logSecurity = (event: string, data: Record<string, any>): void => {
  warn(`Security: ${event}`, data);
};

export const flush = async (): Promise<void> => {
  return new Promise((resolve) => {
    logger.flush();
    setTimeout(resolve, 500);
  });
};

const Logger = { child, trace, debug, info, warn, error, fatal, logRequest, logQuery, logAuth, logSecurity, flush };
export default Logger;
