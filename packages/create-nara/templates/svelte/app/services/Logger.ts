/**
 * Logger Service
 *
 * Simple structured logging without external dependencies.
 * Supports multiple log levels and structured data.
 */

type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';

const LOG_LEVELS: Record<LogLevel, number> = {
  trace: 10,
  debug: 20,
  info: 30,
  warn: 40,
  error: 50,
  fatal: 60,
};

// ANSI color codes for log levels
const COLORS = {
  reset: '\x1b[0m',
  trace: '\x1b[90m',   // Gray
  debug: '\x1b[36m',   // Cyan
  info: '\x1b[32m',    // Green
  warn: '\x1b[33m',    // Yellow
  error: '\x1b[31m',   // Red
  fatal: '\x1b[35m',   // Magenta
  timestamp: '\x1b[90m', // Gray
};

/**
 * Get current log level from environment
 */
function getLogLevel(): LogLevel {
  const level = (process.env.LOG_LEVEL || 'info').toLowerCase() as LogLevel;
  return LOG_LEVELS[level] !== undefined ? level : 'info';
}

/**
 * Check if a log level should be logged
 */
function shouldLog(level: LogLevel): boolean {
  const currentLevel = getLogLevel();
  return LOG_LEVELS[level] >= LOG_LEVELS[currentLevel];
}

/**
 * Format log message with timestamp and metadata
 */
function formatLog(level: LogLevel, message: string, data?: Record<string, any>): string {
  const timestamp = new Date().toISOString();
  const levelUpper = level.toUpperCase().padEnd(5);
  const color = COLORS[level];

  if (data && Object.keys(data).length > 0) {
    return `${COLORS.timestamp}[${timestamp}]${COLORS.reset} ${color}${levelUpper}${COLORS.reset} ${message} ${JSON.stringify(data)}`;
  }
  return `${COLORS.timestamp}[${timestamp}]${COLORS.reset} ${color}${levelUpper}${COLORS.reset} ${message}`;
}

/**
 * Logger class with utility methods
 */
class Logger {
  /**
   * Log trace level message (very detailed debugging)
   */
  trace(message: string, data?: Record<string, any>): void {
    if (shouldLog('trace')) {
      console.log(formatLog('trace', message, data));
    }
  }

  /**
   * Log debug level message
   */
  debug(message: string, data?: Record<string, any>): void {
    if (shouldLog('debug')) {
      console.log(formatLog('debug', message, data));
    }
  }

  /**
   * Log info level message
   */
  info(message: string, data?: Record<string, any>): void {
    if (shouldLog('info')) {
      console.log(formatLog('info', message, data));
    }
  }

  /**
   * Log warning level message
   */
  warn(message: string, data?: Record<string, any>): void {
    if (shouldLog('warn')) {
      console.warn(formatLog('warn', message, data));
    }
  }

  /**
   * Log error level message
   */
  error(message: string, error?: Error | Record<string, any>): void {
    if (shouldLog('error')) {
      if (error instanceof Error) {
        console.error(formatLog('error', message, {
          error: error.message,
          stack: error.stack,
        }));
      } else if (error) {
        console.error(formatLog('error', message, error));
      } else {
        console.error(formatLog('error', message));
      }
    }
  }

  /**
   * Log fatal level message (application crash)
   */
  fatal(message: string, error?: Error | Record<string, any>): void {
    if (shouldLog('fatal')) {
      if (error instanceof Error) {
        console.error(formatLog('fatal', message, {
          error: error.message,
          stack: error.stack,
        }));
      } else if (error) {
        console.error(formatLog('fatal', message, error));
      } else {
        console.error(formatLog('fatal', message));
      }
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
}

// Export singleton instance
export default new Logger();
