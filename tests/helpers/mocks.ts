/**
 * Test Helpers - Mock Factories
 * 
 * Provides mock NaraRequest and NaraResponse objects for testing
 * middlewares, controllers, and core components without a real HTTP server.
 */

import { vi } from 'vitest';
import type { NaraRequest, NaraResponse, NaraMiddleware, NaraHandler } from '../../app/core/types';
import type { User } from '../../app/core/types';

/**
 * Create a mock NaraRequest for testing
 */
export function mockRequest(overrides: Partial<NaraRequest> = {}): NaraRequest {
  const req = {
    method: 'GET',
    path: '/',
    url: '/',
    ip: '127.0.0.1',
    headers: {} as Record<string, string | string[] | undefined>,
    query: {} as Record<string, string>,
    params: {} as Record<string, string>,
    cookies: {} as Record<string, string>,
    user: undefined as User | undefined,
    share: undefined as Record<string, unknown> | undefined,
    requestId: undefined as string | undefined,
    json: vi.fn().mockResolvedValue({}),
    // HyperExpress-specific
    accepts: vi.fn(),
    header: vi.fn((name: string) => undefined),
    ...overrides,
  } as unknown as NaraRequest;

  return req;
}

/**
 * Create a mock NaraResponse for testing
 * Tracks all response calls for assertions
 */
export function mockResponse(overrides: Partial<NaraResponse> = {}): NaraResponse & {
  _status: number;
  _body: unknown;
  _headers: Record<string, string>;
  _cookies: Array<{ name: string; value: string; maxAge?: number; options?: Record<string, unknown> }>;
  _redirectUrl: string | null;
  _sent: boolean;
} {
  const res: any = {
    _status: 200,
    _body: undefined,
    _headers: {},
    _cookies: [],
    _redirectUrl: null,
    _sent: false,

    status(code: number) {
      res._status = code;
      return res;
    },
    json(body: unknown) {
      res._body = body;
      res._sent = true;
      return res;
    },
    send(body: unknown) {
      res._body = body;
      res._sent = true;
      return res;
    },
    header(name: string, value: string) {
      res._headers[name] = value;
      return res;
    },
    setHeader(name: string, value: string) {
      res._headers[name] = value;
      return res;
    },
    getHeader(name: string) {
      return res._headers[name];
    },
    cookie(name: string, value: string, maxAge?: number, options?: Record<string, unknown>) {
      res._cookies.push({ name, value, maxAge, options });
      return res;
    },
    redirect(url: string) {
      res._redirectUrl = url;
      res._sent = true;
      return res;
    },
    type(contentType: string) {
      res._headers['Content-Type'] = contentType;
      return res;
    },
    ...overrides,
  };

  return res;
}

/**
 * Create a mock authenticated user
 */
export function mockUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user-123',
    name: 'Test User',
    email: 'test@example.com',
    phone: '081234567890',
    avatar: null,
    is_verified: true,
    roles: ['user'],
    permissions: [],
    created_at: Date.now(),
    updated_at: Date.now(),
    ...overrides,
  };
}

/**
 * Execute a middleware with mock req/res and return a promise
 * Resolves when next() is called or when the middleware returns
 */
export function runMiddleware(
  middleware: NaraMiddleware,
  req?: NaraRequest,
  res?: NaraResponse
): Promise<{ nextCalled: boolean }> {
  const request = req || mockRequest();
  const response = res || mockResponse();

  return new Promise((resolve) => {
    const next = vi.fn(() => {
      resolve({ nextCalled: true });
    });

    const result = middleware(request as any, response as any, next);

    // If middleware returns without calling next (e.g., sends response)
    if (result instanceof Promise) {
      result.then(() => {
        resolve({ nextCalled: next.mock.calls.length > 0 });
      });
    } else {
      // Synchronous return — if next wasn't called, resolve immediately
      if (!next.mock.calls.length) {
        resolve({ nextCalled: false });
      }
    }
  });
}

/**
 * Create a mock validator function for testing
 */
export function mockValidator<T>(validData: T) {
  return (data: unknown) => {
    const d = data as Record<string, unknown>;
    const errors: Record<string, string[]> = {};

    // Simple check: if _invalid flag is set, return errors
    if (d && (d as any)._invalid === true) {
      return { success: false as const, errors: { field: ['Invalid'] } };
    }

    return { success: true as const, data: validData };
  };
}

/**
 * Create a failing validator for testing
 */
export function failingValidator(errors: Record<string, string[]> = { field: ['Error'] }) {
  return (_data: unknown) => ({
    success: false as const,
    errors,
  });
}
