import { describe, it, expect, vi } from 'vitest';
import Logger, * as loggerFns from '../../app/services/Logger';

describe('Logger', () => {
  it('should export all expected functions', () => {
    expect(typeof Logger.trace).toBe('function');
    expect(typeof Logger.debug).toBe('function');
    expect(typeof Logger.info).toBe('function');
    expect(typeof Logger.warn).toBe('function');
    expect(typeof Logger.error).toBe('function');
    expect(typeof Logger.fatal).toBe('function');
    expect(typeof Logger.child).toBe('function');
    expect(typeof Logger.logRequest).toBe('function');
    expect(typeof Logger.logQuery).toBe('function');
    expect(typeof Logger.logAuth).toBe('function');
    expect(typeof Logger.logSecurity).toBe('function');
    expect(typeof Logger.flush).toBe('function');
  });

  it('should export named functions', () => {
    expect(typeof loggerFns.trace).toBe('function');
    expect(typeof loggerFns.debug).toBe('function');
    expect(typeof loggerFns.info).toBe('function');
    expect(typeof loggerFns.warn).toBe('function');
    expect(typeof loggerFns.error).toBe('function');
    expect(typeof loggerFns.fatal).toBe('function');
  });

  it('should not throw when logging messages', () => {
    expect(() => Logger.trace('test trace')).not.toThrow();
    expect(() => Logger.debug('test debug')).not.toThrow();
    expect(() => Logger.info('test info')).not.toThrow();
    expect(() => Logger.warn('test warn')).not.toThrow();
    expect(() => Logger.error('test error')).not.toThrow();
    expect(() => Logger.fatal('test fatal')).not.toThrow();
  });

  it('should not throw when logging with data', () => {
    const data = { key: 'value' };
    expect(() => Logger.info('test', data)).not.toThrow();
    expect(() => Logger.warn('test', data)).not.toThrow();
    expect(() => Logger.error('test', data)).not.toThrow();
  });

  it('should handle Error objects in error/fatal', () => {
    const err = new Error('test error');
    expect(() => Logger.error('something failed', err)).not.toThrow();
    expect(() => Logger.fatal('critical failure', err)).not.toThrow();
  });

  it('should create child logger', () => {
    const child = Logger.child({ requestId: '123' });
    expect(child).toBeDefined();
    expect(typeof child.info).toBe('function');
  });

  it('should log request data', () => {
    expect(() => Logger.logRequest({
      method: 'GET',
      url: '/test',
      statusCode: 200,
      responseTime: 50,
    })).not.toThrow();
  });

  it('should log query data', () => {
    expect(() => Logger.logQuery('SELECT 1', 5)).not.toThrow();
  });

  it('should log auth events', () => {
    expect(() => Logger.logAuth('login', { userId: '123' })).not.toThrow();
  });

  it('should log security events', () => {
    expect(() => Logger.logSecurity('csrf_failed', { ip: '1.2.3.4' })).not.toThrow();
  });

  it('should flush without error', async () => {
    await expect(Logger.flush()).resolves.toBeUndefined();
  });
});
