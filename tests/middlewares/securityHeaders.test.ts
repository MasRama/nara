/**
 * Tests for Security Headers Middleware
 * 
 * Validates all security headers are set correctly,
 * including HSTS, X-Frame-Options, CSP, and more.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { securityHeaders } from '../../app/middlewares/securityHeaders';
import { mockRequest, mockResponse, runMiddleware } from '../helpers/mocks';

describe('securityHeaders middleware', () => {
  const originalEnv = process.env.NODE_ENV;

  beforeEach(() => {
    process.env.NODE_ENV = 'development';
  });

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
  });

  describe('default headers', () => {
    it('sets X-Frame-Options to DENY by default', async () => {
      const req = mockRequest();
      const res = mockResponse();

      await runMiddleware(securityHeaders(), req, res as any);

      expect(res._headers['X-Frame-Options']).toBe('DENY');
    });

    it('sets X-Content-Type-Options to nosniff', async () => {
      const req = mockRequest();
      const res = mockResponse();

      await runMiddleware(securityHeaders(), req, res as any);

      expect(res._headers['X-Content-Type-Options']).toBe('nosniff');
    });

    it('sets Referrer-Policy', async () => {
      const req = mockRequest();
      const res = mockResponse();

      await runMiddleware(securityHeaders(), req, res as any);

      expect(res._headers['Referrer-Policy']).toBe('strict-origin-when-cross-origin');
    });

    it('sets X-XSS-Protection to 0', async () => {
      const req = mockRequest();
      const res = mockResponse();

      await runMiddleware(securityHeaders(), req, res as any);

      expect(res._headers['X-XSS-Protection']).toBe('0');
    });

    it('sets Permissions-Policy', async () => {
      const req = mockRequest();
      const res = mockResponse();

      await runMiddleware(securityHeaders(), req, res as any);

      expect(res._headers['Permissions-Policy']).toBeDefined();
      // Should include camera=(), microphone=(), etc.
      expect(res._headers['Permissions-Policy']).toContain('camera=()');
      expect(res._headers['Permissions-Policy']).toContain('microphone=()');
    });

    it('calls next() to continue chain', async () => {
      const result = await runMiddleware(securityHeaders());
      expect(result.nextCalled).toBe(true);
    });
  });

  describe('HSTS', () => {
    it('does not set HSTS in development', async () => {
      process.env.NODE_ENV = 'development';
      const req = mockRequest();
      const res = mockResponse();

      await runMiddleware(securityHeaders(), req, res as any);

      expect(res._headers['Strict-Transport-Security']).toBeUndefined();
    });

    it('sets HSTS in production', async () => {
      process.env.NODE_ENV = 'production';
      const req = mockRequest();
      const res = mockResponse();

      await runMiddleware(securityHeaders(), req, res as any);

      expect(res._headers['Strict-Transport-Security']).toBeDefined();
      expect(res._headers['Strict-Transport-Security']).toContain('max-age=');
    });

    it('includes includeSubDomains by default', async () => {
      process.env.NODE_ENV = 'production';
      const req = mockRequest();
      const res = mockResponse();

      await runMiddleware(securityHeaders(), req, res as any);

      expect(res._headers['Strict-Transport-Security']).toContain('includeSubDomains');
    });

    it('can disable HSTS', async () => {
      process.env.NODE_ENV = 'production';
      const req = mockRequest();
      const res = mockResponse();

      await runMiddleware(securityHeaders({ hsts: false }), req, res as any);

      expect(res._headers['Strict-Transport-Security']).toBeUndefined();
    });
  });

  describe('CSP', () => {
    it('does not set CSP by default (opt-in)', async () => {
      const req = mockRequest();
      const res = mockResponse();

      await runMiddleware(securityHeaders(), req, res as any);

      expect(res._headers['Content-Security-Policy']).toBeUndefined();
    });

    it('sets CSP when enabled', async () => {
      const req = mockRequest();
      const res = mockResponse();

      await runMiddleware(securityHeaders({
        csp: { enabled: true },
      }), req, res as any);

      expect(res._headers['Content-Security-Policy']).toBeDefined();
    });

    it('uses report-only header when configured', async () => {
      const req = mockRequest();
      const res = mockResponse();

      await runMiddleware(securityHeaders({
        csp: { enabled: true, reportOnly: true },
      }), req, res as any);

      expect(res._headers['Content-Security-Policy-Report-Only']).toBeDefined();
      expect(res._headers['Content-Security-Policy']).toBeUndefined();
    });
  });

  describe('custom options', () => {
    it('allows custom X-Frame-Options', async () => {
      const req = mockRequest();
      const res = mockResponse();

      await runMiddleware(securityHeaders({ frameOptions: 'SAMEORIGIN' }), req, res as any);

      expect(res._headers['X-Frame-Options']).toBe('SAMEORIGIN');
    });

    it('can disable X-Frame-Options', async () => {
      const req = mockRequest();
      const res = mockResponse();

      await runMiddleware(securityHeaders({ frameOptions: false }), req, res as any);

      expect(res._headers['X-Frame-Options']).toBeUndefined();
    });

    it('can disable X-Content-Type-Options', async () => {
      const req = mockRequest();
      const res = mockResponse();

      await runMiddleware(securityHeaders({ contentTypeOptions: false }), req, res as any);

      expect(res._headers['X-Content-Type-Options']).toBeUndefined();
    });

    it('sets Cross-Origin headers when configured', async () => {
      const req = mockRequest();
      const res = mockResponse();

      await runMiddleware(securityHeaders({
        coep: 'require-corp',
        coop: 'same-origin',
        corp: 'same-origin',
      }), req, res as any);

      expect(res._headers['Cross-Origin-Embedder-Policy']).toBe('require-corp');
      expect(res._headers['Cross-Origin-Opener-Policy']).toBe('same-origin');
      expect(res._headers['Cross-Origin-Resource-Policy']).toBe('same-origin');
    });

    it('can disable Permissions-Policy', async () => {
      const req = mockRequest();
      const res = mockResponse();

      await runMiddleware(securityHeaders({ permissionsPolicy: false }), req, res as any);

      expect(res._headers['Permissions-Policy']).toBeUndefined();
    });
  });
});
