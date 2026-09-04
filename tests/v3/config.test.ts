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

  it('defaults production logging to info unless explicitly overridden', () => {
    expect(parseEnv({ NODE_ENV: 'production', APP_URL: 'https://app.example.com' }).LOG_LEVEL).toBe('info');
    expect(
      parseEnv({ NODE_ENV: 'production', APP_URL: 'https://app.example.com', LOG_LEVEL: 'debug' }).LOG_LEVEL,
    ).toBe('debug');
  });

  it('validates reverse-proxy trust and security numeric settings', () => {
    const base = { NODE_ENV: 'development' } as Record<string, string>;
    expect(parseEnv({ ...base, TRUST_PROXY: 'true', TRUST_PROXY_HOPS: '2' }).TRUST_PROXY_HOPS).toBe(2);
    expect(() => parseEnv({ ...base, TRUST_PROXY: 'yes' })).toThrow(/TRUST_PROXY/);
    expect(() => parseEnv({ ...base, TRUST_PROXY_HOPS: '11' })).toThrow(/TRUST_PROXY_HOPS/);
    expect(() => parseEnv({ ...base, MAX_JSON_BODY_BYTES: '-1' })).toThrow(/MAX_JSON_BODY_BYTES/);
    expect(() => parseEnv({ ...base, AUTH_RATE_LIMIT_MAX: '0' })).toThrow(/AUTH_RATE_LIMIT_MAX/);
  });

  it('reports malformed values with their field names', () => {
    expect(() => parseEnv({ PORT: 'not-a-port' })).toThrow(/PORT/);
  });
});
