import { describe, expect, it } from 'vitest';
import { parseEnv } from '../../src/shared/config';

describe('v3 configuration', () => {
  it('preserves development defaults', () => {
    const config = parseEnv({ NODE_ENV: 'development' });

    expect(config.PORT).toBe(5555);
    expect(config.VITE_PORT).toBe(5173);
    expect(config.APP_URL).toBe('http://localhost:5173');
    expect(config.LOG_LEVEL).toBe('debug');
  });

  it('defaults APP_URL to the configured Vite browser port in development', () => {
    const config = parseEnv({ NODE_ENV: 'development', VITE_PORT: '6123' });

    expect(config.APP_URL).toBe('http://localhost:6123');
  });

  it('requires APP_URL in production', () => {
    expect(() => parseEnv({ NODE_ENV: 'production' })).toThrow(
      'APP_URL: required in production',
    );
  });

  it('reports malformed values with their field names', () => {
    expect(() => parseEnv({ PORT: 'not-a-port' })).toThrow(/PORT/);
  });
});
