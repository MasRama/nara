/**
 * Tests for CSRF Middleware
 * 
 * Validates Double Submit Cookie pattern, safe method skipping,
 * token generation, header/body validation, and bypass options.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { csrf, csrfToken, getCSRFToken } from '../../app/middlewares/csrf';
import { mockRequest, mockResponse, runMiddleware } from '../helpers/mocks';

describe('csrf middleware', () => {
  describe('safe methods (GET, HEAD, OPTIONS)', () => {
    it('passes through GET requests and sets cookie', async () => {
      const req = mockRequest({ method: 'GET', cookies: {} } as any);
      const res = mockResponse();

      const result = await runMiddleware(csrf(), req, res as any);

      expect(result.nextCalled).toBe(true);
      // Should set CSRF cookie
      expect(res._cookies.length).toBeGreaterThan(0);
      expect(res._cookies[0].name).toBe('csrf_token');
    });

    it('passes through HEAD requests', async () => {
      const req = mockRequest({ method: 'HEAD', cookies: {} } as any);
      const res = mockResponse();

      const result = await runMiddleware(csrf(), req, res as any);
      expect(result.nextCalled).toBe(true);
    });

    it('passes through OPTIONS requests', async () => {
      const req = mockRequest({ method: 'OPTIONS', cookies: {} } as any);
      const res = mockResponse();

      const result = await runMiddleware(csrf(), req, res as any);
      expect(result.nextCalled).toBe(true);
    });
  });

  describe('unsafe methods (POST, PUT, DELETE)', () => {
    it('blocks POST when no CSRF token is provided', async () => {
      const token = 'existing-token-123';
      const req = mockRequest({
        method: 'POST',
        cookies: { csrf_token: token },
        headers: {},
      } as any);
      const res = mockResponse();

      const result = await runMiddleware(csrf(), req, res as any);

      expect(result.nextCalled).toBe(false);
      expect(res._status).toBe(403);
    });

    it('allows POST when header token matches cookie token', async () => {
      const token = 'valid-token-abc';
      const req = mockRequest({
        method: 'POST',
        cookies: { csrf_token: token },
        headers: { 'x-csrf-token': token },
      } as any);
      const res = mockResponse();

      const result = await runMiddleware(csrf(), req, res as any);

      expect(result.nextCalled).toBe(true);
    });

    it('blocks POST when header token does not match cookie', async () => {
      const req = mockRequest({
        method: 'POST',
        cookies: { csrf_token: 'cookie-token' },
        headers: { 'x-csrf-token': 'wrong-token' },
      } as any);
      const res = mockResponse();

      const result = await runMiddleware(csrf(), req, res as any);

      expect(result.nextCalled).toBe(false);
      expect(res._status).toBe(403);
    });

    it('blocks PUT when no token provided', async () => {
      const req = mockRequest({
        method: 'PUT',
        cookies: { csrf_token: 'token' },
        headers: {},
      } as any);
      const res = mockResponse();

      const result = await runMiddleware(csrf(), req, res as any);
      expect(result.nextCalled).toBe(false);
    });

    it('blocks DELETE when no token provided', async () => {
      const req = mockRequest({
        method: 'DELETE',
        cookies: { csrf_token: 'token' },
        headers: {},
      } as any);
      const res = mockResponse();

      const result = await runMiddleware(csrf(), req, res as any);
      expect(result.nextCalled).toBe(false);
    });
  });

  describe('token generation', () => {
    it('generates new token when cookie does not exist', async () => {
      const req = mockRequest({ method: 'GET', cookies: {} } as any);
      const res = mockResponse();

      await runMiddleware(csrf(), req, res as any);

      expect(res._cookies.length).toBeGreaterThan(0);
      expect(res._cookies[0].value.length).toBeGreaterThan(0);
    });

    it('reuses existing token from cookie', async () => {
      const existingToken = 'existing-token-xyz';
      const req = mockRequest({
        method: 'GET',
        cookies: { csrf_token: existingToken },
      } as any);
      const res = mockResponse();

      await runMiddleware(csrf(), req, res as any);

      // Should not set a new cookie since one already exists
      expect(res._cookies.length).toBe(0);
    });

    it('attaches csrfToken to request object', async () => {
      const token = 'my-csrf-token';
      const req = mockRequest({
        method: 'GET',
        cookies: { csrf_token: token },
      } as any);
      const res = mockResponse();

      await runMiddleware(csrf(), req, res as any);

      expect((req as any).csrfToken).toBe(token);
    });
  });

  describe('Authorization header bypass', () => {
    it('does NOT skip CSRF check by default when Authorization header is present', async () => {
      const req = mockRequest({
        method: 'POST',
        cookies: { csrf_token: 'token' },
        headers: { authorization: 'Bearer token123' },
      } as any);
      const res = mockResponse();

      const result = await runMiddleware(csrf(), req, res as any);

      // Default is now false — Authorization header does not bypass CSRF
      expect(result.nextCalled).toBe(false);
    });

    it('skips when skipIfAuthorization is explicitly true', async () => {
      const req = mockRequest({
        method: 'POST',
        cookies: {},
        headers: { authorization: 'Bearer token123' },
      } as any);
      const res = mockResponse();

      const mw = csrf({ skipIfAuthorization: true });
      const result = await runMiddleware(mw, req, res as any);

      expect(result.nextCalled).toBe(true);
    });
  });

  describe('custom skip function', () => {
    it('skips CSRF when skip function returns true', async () => {
      const req = mockRequest({
        method: 'POST',
        path: '/api/webhook',
        cookies: {},
      } as any);
      const res = mockResponse();

      const mw = csrf({
        skip: (req) => req.path === '/api/webhook',
      });

      const result = await runMiddleware(mw, req, res as any);
      expect(result.nextCalled).toBe(true);
    });

    it('does not skip when skip function returns false', async () => {
      const req = mockRequest({
        method: 'POST',
        path: '/users',
        cookies: { csrf_token: 'token' },
        headers: {},
      } as any);
      const res = mockResponse();

      const mw = csrf({
        skip: (req) => req.path === '/api/webhook',
      });

      const result = await runMiddleware(mw, req, res as any);
      expect(result.nextCalled).toBe(false);
    });
  });

  describe('custom options', () => {
    it('uses custom cookie name', async () => {
      const token = 'my-token';
      const req = mockRequest({
        method: 'POST',
        cookies: { my_csrf: token },
        headers: { 'x-csrf-token': token },
      } as any);
      const res = mockResponse();

      const mw = csrf({ cookieName: 'my_csrf' });
      const result = await runMiddleware(mw, req, res as any);

      expect(result.nextCalled).toBe(true);
    });

    it('uses custom header name', async () => {
      const token = 'my-token';
      const req = mockRequest({
        method: 'POST',
        cookies: { csrf_token: token },
        headers: { 'x-custom-csrf': token },
      } as any);
      const res = mockResponse();

      const mw = csrf({ headerName: 'X-Custom-CSRF' });
      const result = await runMiddleware(mw, req, res as any);

      expect(result.nextCalled).toBe(true);
    });
  });
});

describe('csrfToken middleware', () => {
  it('generates token and calls next without validation', async () => {
    const req = mockRequest({ method: 'GET', cookies: {} } as any);
    const res = mockResponse();

    const result = await runMiddleware(csrfToken(), req, res as any);

    expect(result.nextCalled).toBe(true);
    expect(res._cookies.length).toBeGreaterThan(0);
  });

  it('reuses existing cookie token', async () => {
    const req = mockRequest({
      method: 'GET',
      cookies: { csrf_token: 'existing' },
    } as any);
    const res = mockResponse();

    await runMiddleware(csrfToken(), req, res as any);

    expect(res._cookies.length).toBe(0);
  });
});

describe('getCSRFToken', () => {
  it('returns csrfToken from request', () => {
    const req = mockRequest() as any;
    req.csrfToken = 'test-token';

    expect(getCSRFToken(req)).toBe('test-token');
  });

  it('returns undefined when not set', () => {
    const req = mockRequest();
    expect(getCSRFToken(req)).toBeUndefined();
  });
});
