import { z } from 'zod';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { environmentVariables, parseEnv, readFeatureEnv } from '../../src/shared/config';

describe('v3 configuration', () => {
  it('preserves development defaults', () => {
    const config = parseEnv({ NODE_ENV: 'development' });

    expect(config.PORT).toBe(5555);
    expect(config.APP_URL).toBe('http://localhost:5555');
    expect(config.LOG_LEVEL).toBe('debug');
  });

  it('defaults APP_URL to the configured application port in development', () => {
    const config = parseEnv({ NODE_ENV: 'development', PORT: '6123' });

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

describe('feature-owned environment', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('parses the variables a Feature owns and records the owner', () => {
    vi.stubEnv('DEMO_LIMIT', '7');
    const config = readFeatureEnv('demo', {
      DEMO_LIMIT: z.coerce.number().int().positive(),
      DEMO_LABEL: z.string().default('fallback'),
    });

    expect(config).toEqual({ DEMO_LIMIT: 7, DEMO_LABEL: 'fallback' });
    expect(environmentVariables().get('DEMO_LIMIT')).toBe('demo');
    expect(environmentVariables().get('PORT')).toBe('core');
  });

  it('names the owning Feature when a value is invalid', () => {
    vi.stubEnv('BROKEN_LIMIT', '0');
    expect(() => readFeatureEnv('broken', { BROKEN_LIMIT: z.coerce.number().int().positive() })).toThrow(
      /validation failed for the broken feature:\n  - BROKEN_LIMIT:/,
    );
    expect(environmentVariables().has('BROKEN_LIMIT')).toBe(false);
  });

  it('gives every variable exactly one owner', () => {
    expect(() => readFeatureEnv('demo', { PORT: z.string().optional() })).toThrow(
      'Environment variable PORT is read by both core and the demo feature',
    );
    readFeatureEnv('first', { SHARED_SETTING: z.string().optional() });
    expect(() => readFeatureEnv('second', { SHARED_SETTING: z.string().optional() })).toThrow(
      'Environment variable SHARED_SETTING is read by both first and the second feature',
    );
  });
});
