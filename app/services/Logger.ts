/**
 * Logger Service
 * 
 * High-performance logging system using Pino with the following features:
 * - Multiple log levels: trace, debug, info, warn, error, fatal
 * - Structured JSON (or pretty human-readable) to stdout + file
 * - Pretty (colored, readable) when in dev / TTY / LOG_PRETTY=true
 * - Raw JSON when in containers / piped / LOG_PRETTY=false (for log tools)
 * - Automatic log rotation (daily files, max 14 days retention)
 * - Request ID tracking for distributed tracing
 * - Performance optimized (Pino is 5x faster than Winston)
 * 
 * Usage:
 * ```typescript
 * import Logger from 'app/services/Logger';
 * 
 * Logger.info('User logged in', { userId: '123', email: 'user@example.com' });
 * Logger.error('Database connection failed', { error: err.message });
 * Logger.debug('Processing request', { requestId: 'abc-123' });
 * ```
 * 
 * Log Levels (in order of severity):
 * - trace (10): Very detailed debugging information
 * - debug (20): Debugging information
 * - info (30): General informational messages
 * - warn (40): Warning messages
 * - error (50): Error messages
 * - fatal (60): Fatal errors that require immediate attention
 */

import pino from 'pino';
import path from 'path';
import fs from 'fs';

// Ensure environment is loaded (from .env or .env.production) *before*
// we read process.env for LOG_LEVEL below. This import triggers top-level
// loading logic in @config/env.ts
import '@config';

// Ensure logs directory exists
const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Determine log level from environment
const LOG_LEVEL = process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug');
const NODE_ENV = process.env.NODE_ENV || 'development';

// Decide console output format:
// - Use pino-pretty (human readable, colored, single-line friendly) when:
//   * development, OR
//   * LOG_PRETTY=true (force for local prod testing), OR
//   * running in an interactive TTY (you see it directly in terminal)
// - Otherwise (docker, pm2 detached, CI, piped logs, k8s) → raw JSON to stdout
//   (so log collectors can parse structured data easily)
// Files always get raw structured JSON (good for both cases).
const usePrettyConsole =
  process.env.LOG_PRETTY === 'true' ||
  (process.env.LOG_PRETTY !== 'false' && (NODE_ENV === 'development' || process.stdout.isTTY));

/**
 * Environment variables that affect logging:
 *   LOG_LEVEL=debug|info|...   (default: debug in dev, info in prod)
 *   LOG_PRETTY=true            (force human-readable pretty output even in production)
 *   LOG_PRETTY=false           (force raw JSON even in a TTY)
 *
 * Tip: when running production build locally for testing/debugging:
 *   LOG_LEVEL=debug LOG_PRETTY=true node build/server.js
 */

/**
 * Pino configuration
 */
const pinoConfig: pino.LoggerOptions = {
  level: LOG_LEVEL,
  
  // Base configuration
  base: {
    env: NODE_ENV,
    pid: process.pid,
  },

  // Timestamp format
  timestamp: () => `,"time":"${new Date().toISOString()}"`,

  // Format error objects properly
  serializers: {
    error: pino.stdSerializers.err,
    req: pino.stdSerializers.req,
    res: pino.stdSerializers.res,
  },

  // Redact sensitive information
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

/**
 * Create transport for log rotation and pretty printing
 */
const transport = pino.transport({
  targets: [
    // Console/stdout target (chosen for readability vs machine parseability)
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
            destination: 1, // stdout (fd 1) → raw JSON (for log shippers)
          },
        },

    // File output with rotation (always)
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

    // Separate error log file (errors only)
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

/**
 * Create logger instance
 */
const logger = pino(pinoConfig, transport);

/**
 * Logger class with additional utility methods
 */
class Logger {
  private logger: pino.Logger;

  constructor() {
    this.logger = logger;
  }

  /**
   * Create a child logger with additional context
   * @param bindings - Additional context to include in all logs
   * @returns Child logger instance
   */
  child(bindings: Record<string, any>): pino.Logger {
    return this.logger.child(bindings);
  }

  /**
   * Log trace level message (very detailed debugging)
   */
  trace(message: string, data?: Record<string, any>): void {
    if (data) {
      this.logger.trace(data, message);
    } else {
      this.logger.trace(message);
    }
  }

  /**
   * Log debug level message
   */
  debug(message: string, data?: Record<string, any>): void {
    if (data) {
      this.logger.debug(data, message);
    } else {
      this.logger.debug(message);
    }
  }

  /**
   * Log info level message
   */
  info(message: string, data?: Record<string, any>): void {
    if (data) {
      this.logger.info(data, message);
    } else {
      this.logger.info(message);
    }
  }

  /**
   * Log warning level message
   */
  warn(message: string, data?: Record<string, any>): void {
    if (data) {
      this.logger.warn(data, message);
    } else {
      this.logger.warn(message);
    }
  }

  /**
   * Log error level message
   */
  error(message: string, error?: Error | Record<string, any>): void {
    if (error instanceof Error) {
      this.logger.error({ err: error }, message);
    } else if (error) {
      this.logger.error(error, message);
    } else {
      this.logger.error(message);
    }
  }

  /**
   * Log fatal level message (application crash)
   */
  fatal(message: string, error?: Error | Record<string, any>): void {
    if (error instanceof Error) {
      this.logger.fatal({ err: error }, message);
    } else if (error) {
      this.logger.fatal(error, message);
    } else {
      this.logger.fatal(message);
    }
  }

  /**
   * Log HTTP request
   */
  logRequest(data: {
    method: string;
    url: string;
    statusCode?: number;
    responseTime?: number;
    userId?: string;
    ip?: string;
  }): void {
    this.info('HTTP Request', data);
  }

  /**
   * Log database query (use sparingly in production)
   */
  logQuery(query: string, duration?: number): void {
    this.debug('Database Query', { query, duration });
  }

  /**
   * Log authentication event
   */
  logAuth(event: string, data: Record<string, any>): void {
    this.info(`Auth: ${event}`, data);
  }

  /**
   * Log security event
   */
  logSecurity(event: string, data: Record<string, any>): void {
    this.warn(`Security: ${event}`, data);
  }

  /**
   * Flush logs (useful before process exit)
   */
  async flush(): Promise<void> {
    return new Promise((resolve) => {
      this.logger.flush();
      setTimeout(resolve, 500);
    });
  }
}

// Export singleton instance
export default new Logger();

/**
 * Example usage in controllers:
 *
 * import Logger from 'app/services/Logger';
 *
 * class UserController {
 *   async login(req, res) {
 *     try {
 *       Logger.info('User login attempt', { email: req.body.email });
 *       // ... login logic
 *       Logger.logAuth('login_success', { userId: user.id, email: user.email });
 *       return res.json({ success: true });
 *     } catch (error) {
 *       Logger.error('Login failed', error);
 *       return res.status(500).json({ error: 'Login failed' });
 *     }
 *   }
 * }
 *
 * Example with request context (child logger):
 *
 * class OrderController {
 *   async process(req: NaraRequest, res: NaraResponse) {
 *     // Create child logger with request context
 *     const logger = Logger.child({ requestId: req.requestId });
 *
 *     logger.info('Processing order'); // All logs will include requestId
 *
 *     try {
 *       logger.debug('Validating order', { orderId: req.body.orderId });
 *       // ... processing logic
 *       logger.info('Order processed successfully');
 *     } catch (error) {
 *       logger.error('Order processing failed', error);
 *     }
 *   }
 * }
 */
