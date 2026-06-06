/**
 * Tests for Rate Limit Middleware
 * 
 * Validates sliding window algorithm, header responses,
 * limit enforcement, custom keys, and reset functionality.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { rateLimit, strictRateLimit, apiRateLimit, resetRateLimit } from '../../app/middlewares/rateLimit';
import { mockRequest, mockResponse, runMiddleware } from '../helpers/mocks';

describe('rateLimit middleware', () => {
  beforeEach(() => {
    // Reset all rate limits between tests
    resetRateLimit('test:127.0.0.1');
    resetRateLimit('test:192.168.1.1');
    resetRateLimit('test:custom-key');
  });

  it('allows requests within the limit', async () => {
    const mw = rateLimit({ maxRequests: 5, windowMs: 60000, name: 'test' });
    const req = mockRequest({ ip: '127.0.0.1' } as any);
    const res = mockResponse();

    const result = await runMiddleware(mw, req, res as any);

    expect(result.nextCalled).toBe(true);
  });

  it('blocks requests when limit is exceeded', async () => {
    const mw = rateLimit({ maxRequests: 2, windowMs: 60000, name: 'test' });

    // Make 3 requests (limit is 2)
    for (let i = 0; i < 2; i++) {
      const req = mockRequest({ ip: '127.0.0.1' } as any);
      const res = mockResponse();
      await runMiddleware(mw, req, res as any);
    }

    // Third request should be blocked
    const req = mockRequest({ ip: '127.0.0.1' } as any);
    const res = mockResponse();
    const result = await runMiddleware(mw, req, res as any);

    expect(result.nextCalled).toBe(false);
    expect(res._status).toBe(429);
    expect((res._body as any).code).toBe('TOO_MANY_REQUESTS');
  });

  it('sets rate limit headers', async () => {
    const mw = rateLimit({ maxRequests: 10, windowMs: 60000, name: 'test' });
    const req = mockRequest({ ip: '127.0.0.1' } as any);
    const res = mockResponse();

    await runMiddleware(mw, req, res as any);

    expect(res._headers['X-RateLimit-Limit']).toBe('10');
    expect(res._headers['X-RateLimit-Remaining']).toBeDefined();
    expect(res._headers['X-RateLimit-Reset']).toBeDefined();
  });

  it('decrements remaining count with each request', async () => {
    const mw = rateLimit({ maxRequests: 5, windowMs: 60000, name: 'test' });

    const req1 = mockRequest({ ip: '192.168.1.1' } as any);
    const res1 = mockResponse();
    await runMiddleware(mw, req1, res1 as any);

    expect(res1._headers['X-RateLimit-Remaining']).toBe('4');

    const req2 = mockRequest({ ip: '192.168.1.1' } as any);
    const res2 = mockResponse();
    await runMiddleware(mw, req2, res2 as any);

    expect(res2._headers['X-RateLimit-Remaining']).toBe('3');
  });

  it('sets Retry-After header when rate limited', async () => {
    const mw = rateLimit({ maxRequests: 1, windowMs: 60000, name: 'test' });

    // First request: allowed
    const req1 = mockRequest({ ip: '127.0.0.1' } as any);
    const res1 = mockResponse();
    await runMiddleware(mw, req1, res1 as any);

    // Second request: blocked
    const req2 = mockRequest({ ip: '127.0.0.1' } as any);
    const res2 = mockResponse();
    await runMiddleware(mw, req2, res2 as any);

    expect(res2._headers['Retry-After']).toBeDefined();
  });

  it('does not set headers when headers option is false', async () => {
    const mw = rateLimit({ maxRequests: 5, windowMs: 60000, headers: false, name: 'test' });
    const req = mockRequest({ ip: '127.0.0.1' } as any);
    const res = mockResponse();

    await runMiddleware(mw, req, res as any);

    expect(res._headers['X-RateLimit-Limit']).toBeUndefined();
  });

  describe('custom key generator', () => {
    it('uses custom key for rate limiting', async () => {
      const mw = rateLimit({
        maxRequests: 2,
        windowMs: 60000,
        name: 'test',
        keyGenerator: () => 'custom-key',
      });

      // Different IPs but same custom key
      const req1 = mockRequest({ ip: '1.1.1.1' } as any);
      const res1 = mockResponse();
      await runMiddleware(mw, req1, res1 as any);

      const req2 = mockRequest({ ip: '2.2.2.2' } as any);
      const res2 = mockResponse();
      await runMiddleware(mw, req2, res2 as any);

      // Third request should be blocked even from different IP
      const req3 = mockRequest({ ip: '3.3.3.3' } as any);
      const res3 = mockResponse();
      const result = await runMiddleware(mw, req3, res3 as any);

      expect(result.nextCalled).toBe(false);
    });
  });

  describe('skip function', () => {
    it('skips rate limiting when skip returns true', async () => {
      const mw = rateLimit({
        maxRequests: 1,
        windowMs: 60000,
        name: 'test',
        skip: (req) => req.ip === '127.0.0.1',
      });

      // Multiple requests from skip IP should all pass
      for (let i = 0; i < 5; i++) {
        const req = mockRequest({ ip: '127.0.0.1' } as any);
        const res = mockResponse();
        const result = await runMiddleware(mw, req, res as any);
        expect(result.nextCalled).toBe(true);
      }
    });
  });

  describe('resetRateLimit', () => {
    it('resets rate limit for a specific key', async () => {
      const mw = rateLimit({ maxRequests: 1, windowMs: 60000, name: 'test' });

      // Use up the limit
      const req1 = mockRequest({ ip: '127.0.0.1' } as any);
      const res1 = mockResponse();
      await runMiddleware(mw, req1, res1 as any);

      // Reset
      resetRateLimit('test:127.0.0.1');

      // Should be allowed again
      const req2 = mockRequest({ ip: '127.0.0.1' } as any);
      const res2 = mockResponse();
      const result = await runMiddleware(mw, req2, res2 as any);

      expect(result.nextCalled).toBe(true);
    });
  });
});

describe('strictRateLimit', () => {
  it('creates a rate limiter with strict defaults', () => {
    const mw = strictRateLimit();
    expect(mw).toBeDefined();
    expect(typeof mw).toBe('function');
  });
});

describe('apiRateLimit', () => {
  it('creates a rate limiter with API defaults', () => {
    const mw = apiRateLimit();
    expect(mw).toBeDefined();
    expect(typeof mw).toBe('function');
  });
});
