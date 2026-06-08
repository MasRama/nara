/**
 * Tests for BaseController
 * 
 * Validates auth guards, request body validation,
 * pagination helpers, and query/param extraction.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BaseController } from '../../app/core/BaseController';
import { AuthError, ForbiddenError, ValidationError } from '../../app/core/errors';
import { mockRequest, mockResponse, mockUser } from '../helpers/mocks';
import type { NaraRequest, NaraResponse } from '../../app/core/types';
import type { Validator, ValidationResult } from '../../app/validators/validate';

/**
 * Concrete test controller to test abstract base class
 */
class TestController extends BaseController {
  // Expose protected methods for testing
  public testRequireAuth(req: NaraRequest) {
    this.requireAuth(req);
  }

  public testRequireInertia(res: NaraResponse) {
    this.requireInertia(res);
  }

  public async testGetBody<T>(req: NaraRequest, schema: Validator<T>): Promise<T> {
    return this.getBody(req, schema);
  }

  public testGetPaginationParams(req: NaraRequest) {
    return this.getPaginationParams(req);
  }

  public testGetQueryParam(req: NaraRequest, key: string, defaultValue?: string) {
    return this.getQueryParam(req, key, defaultValue);
  }

  public testGetParam(req: NaraRequest, key: string) {
    return this.getParam(req, key);
  }

  public testGetRequiredParam(req: NaraRequest, key: string) {
    return this.getRequiredParam(req, key);
  }

  // Test auto-binding: pass method as callback
  public getHandler() {
    return this.testRequireAuth;
  }
}

describe('BaseController', () => {
  let controller: TestController;

  beforeEach(() => {
    controller = new TestController();
  });

  describe('constructor (auto-binding)', () => {
    it('auto-binds methods to preserve this context', () => {
      // Extracting a method and calling it should still work
      const handler = controller.getHandler();
      const req = mockRequest({ user: mockUser() });

      // Should not throw because 'this' is bound
      expect(() => handler(req as any)).not.toThrow();
    });
  });

  describe('requireAuth', () => {
    it('does not throw when user is present', () => {
      const req = mockRequest({ user: mockUser() });
      expect(() => controller.testRequireAuth(req as any)).not.toThrow();
    });

    it('throws AuthError when user is not present', () => {
      const req = mockRequest();
      expect(() => controller.testRequireAuth(req as any)).toThrow(AuthError);
    });

    it('throws AuthError with default message', () => {
      const req = mockRequest();
      expect(() => controller.testRequireAuth(req as any)).toThrow('Unauthorized');
    });
  });

  describe('requireInertia', () => {
    it('does not throw when inertia function exists on response', () => {
      const res = mockResponse();
      (res as any).inertia = vi.fn();

      expect(() => controller.testRequireInertia(res as any)).not.toThrow();
    });

    it('throws Error when inertia is not available', () => {
      const res = mockResponse();

      expect(() => controller.testRequireInertia(res as any)).toThrow(
        'Inertia support is not enabled'
      );
    });
  });

  describe('getBody', () => {
    it('returns validated data when validation passes', async () => {
      const req = mockRequest();
      const validData = { name: 'Test', email: 'test@example.com' };

      (req as any).body = validData;

      const schema: Validator<typeof validData> = (data: unknown) => ({
        success: true,
        data: data as typeof validData,
      });

      const result = await controller.testGetBody(req as any, schema);
      expect(result).toEqual(validData);
    });

    it('throws ValidationError when validation fails', async () => {
      const req = mockRequest();
      (req as any).body = { name: '' };

      const schema: Validator<any> = (_data: unknown) => ({
        success: false,
        errors: { name: ['Name is required'] },
      });

      await expect(controller.testGetBody(req as any, schema)).rejects.toThrow(ValidationError);
    });

    it('ValidationError contains field errors', async () => {
      const req = mockRequest();
      (req as any).body = {};

      const errors = { email: ['Required'], password: ['Too short'] };
      const schema: Validator<any> = () => ({
        success: false,
        errors,
      });

      try {
        await controller.testGetBody(req as any, schema);
        expect.fail('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(ValidationError);
        expect((err as ValidationError).errors).toEqual(errors);
      }
    });
  });

  describe('getPaginationParams', () => {
    it('returns defaults when no query params', () => {
      const req = mockRequest({ query: {} } as any);
      const params = controller.testGetPaginationParams(req as any);

      expect(params.page).toBe(1);
      expect(params.limit).toBe(10);
      expect(params.search).toBe('');
    });

    it('parses page from query', () => {
      const req = mockRequest({ query: { page: '3' } } as any);
      const params = controller.testGetPaginationParams(req as any);

      expect(params.page).toBe(3);
    });

    it('parses limit from query', () => {
      const req = mockRequest({ query: { limit: '25' } } as any);
      const params = controller.testGetPaginationParams(req as any);

      expect(params.limit).toBe(25);
    });

    it('clamps limit to MAX_PAGE_SIZE', () => {
      const req = mockRequest({ query: { limit: '9999' } } as any);
      const params = controller.testGetPaginationParams(req as any);

      expect(params.limit).toBeLessThanOrEqual(100);
    });

    it('parses search from query', () => {
      const req = mockRequest({ query: { search: 'hello' } } as any);
      const params = controller.testGetPaginationParams(req as any);

      expect(params.search).toBe('hello');
    });

    it('handles invalid page values', () => {
      const req = mockRequest({ query: { page: 'abc' } } as any);
      const params = controller.testGetPaginationParams(req as any);

      expect(params.page).toBe(1); // fallback to default
    });
  });

  describe('getQueryParam', () => {
    it('returns query param value', () => {
      const req = mockRequest({ query: { filter: 'active' } } as any);
      const value = controller.testGetQueryParam(req as any, 'filter');

      expect(value).toBe('active');
    });

    it('returns default when param not present', () => {
      const req = mockRequest({ query: {} } as any);
      const value = controller.testGetQueryParam(req as any, 'filter', 'all');

      expect(value).toBe('all');
    });

    it('returns empty string when no default and param missing', () => {
      const req = mockRequest({ query: {} } as any);
      const value = controller.testGetQueryParam(req as any, 'filter');

      expect(value).toBe('');
    });
  });

  describe('getParam', () => {
    it('returns route param value', () => {
      const req = mockRequest({ params: { id: 'abc-123' } } as any);
      const value = controller.testGetParam(req as any, 'id');

      expect(value).toBe('abc-123');
    });

    it('returns undefined when param not present', () => {
      const req = mockRequest({ params: {} } as any);
      const value = controller.testGetParam(req as any, 'id');

      expect(value).toBeUndefined();
    });
  });

  describe('getRequiredParam', () => {
    it('returns route param when present', () => {
      const req = mockRequest({ params: { id: 'abc-123' } } as any);
      const value = controller.testGetRequiredParam(req as any, 'id');

      expect(value).toBe('abc-123');
    });

    it('throws ValidationError when param is missing', () => {
      const req = mockRequest({ params: {} } as any);

      expect(() => controller.testGetRequiredParam(req as any, 'id')).toThrow(ValidationError);
    });
  });
});
