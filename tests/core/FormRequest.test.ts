/**
 * Tests for FormRequest
 * 
 * Validates authorization, validation lifecycle,
 * data access, and error handling.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FormRequest } from '../../app/core/FormRequest';
import { ValidationError, ForbiddenError, AuthError } from '../../app/core/errors';
import { mockRequest, mockUser } from '../helpers/mocks';
import type { Validator } from '../../app/validators/validate';
import type { NaraRequest } from '../../app/core/types';

// --- Test fixtures ---

interface CreatePostData {
  title: string;
  content: string;
}

const createPostValidator: Validator<CreatePostData> = (data: unknown) => {
  const d = data as Record<string, unknown>;
  const errors: Record<string, string[]> = {};

  if (!d.title || typeof d.title !== 'string') {
    errors.title = ['Title is required'];
  }
  if (!d.content || typeof d.content !== 'string') {
    errors.content = ['Content is required'];
  }

  if (Object.keys(errors).length > 0) {
    return { success: false, errors };
  }

  return {
    success: true,
    data: { title: d.title as string, content: d.content as string },
  };
};

class CreatePostRequest extends FormRequest<CreatePostData> {
  authorize(): boolean {
    return this.user !== undefined;
  }

  rules(): Validator<CreatePostData> {
    return createPostValidator;
  }
}

class AdminOnlyRequest extends FormRequest<CreatePostData> {
  authorize(): boolean {
    return this.user?.roles?.includes('admin') ?? false;
  }

  rules(): Validator<CreatePostData> {
    return createPostValidator;
  }
}

class AlwaysAllowRequest extends FormRequest<CreatePostData> {
  authorize(): boolean {
    return true;
  }

  rules(): Validator<CreatePostData> {
    return createPostValidator;
  }
}

// --- Tests ---

describe('FormRequest', () => {
  describe('from() - successful validation', () => {
    it('returns FormRequest with validated data', async () => {
      const req = mockRequest({
        user: mockUser(),
        body: { title: 'Hello', content: 'World' },
      } as any);

      const formReq = await CreatePostRequest.from(req as any);
      const data = formReq.validated();

      expect(data).toEqual({ title: 'Hello', content: 'World' });
    });

    it('passes() returns true after successful validation', async () => {
      const req = mockRequest({
        user: mockUser(),
        body: { title: 'Hello', content: 'World' },
      } as any);

      const formReq = await CreatePostRequest.from(req as any);
      expect(formReq.passes()).toBe(true);
    });

    it('fails() returns false after successful validation', async () => {
      const req = mockRequest({
        user: mockUser(),
        body: { title: 'Hello', content: 'World' },
      } as any);

      const formReq = await CreatePostRequest.from(req as any);
      expect(formReq.fails()).toBe(false);
    });

    it('errors() returns null on success', async () => {
      const req = mockRequest({
        user: mockUser(),
        body: { title: 'Hello', content: 'World' },
      } as any);

      const formReq = await CreatePostRequest.from(req as any);
      expect(formReq.errors()).toBeNull();
    });
  });

  describe('from() - validation failure', () => {
    it('throws ValidationError when data is invalid', async () => {
      const req = mockRequest({
        user: mockUser(),
        body: { title: '', content: '' },
      } as any);

      await expect(CreatePostRequest.from(req as any)).rejects.toThrow(ValidationError);
    });

    it('ValidationError contains field errors', async () => {
      const req = mockRequest({
        user: mockUser(),
        json: vi.fn().mockResolvedValue({}),
      } as any);

      try {
        await CreatePostRequest.from(req as any);
        expect.fail('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(ValidationError);
        const validationErr = err as ValidationError;
        expect(validationErr.errors).toHaveProperty('title');
        expect(validationErr.errors).toHaveProperty('content');
      }
    });
  });

  describe('from() - authorization failure', () => {
    it('throws ForbiddenError when not authorized', async () => {
      const req = mockRequest({
        user: undefined, // not authenticated
        body: { title: 'Hello', content: 'World' },
      } as any);

      await expect(CreatePostRequest.from(req as any)).rejects.toThrow(ForbiddenError);
    });

    it('throws ForbiddenError for insufficient role', async () => {
      const req = mockRequest({
        user: mockUser({ roles: ['user'] }), // not admin
        body: { title: 'Hello', content: 'World' },
      } as any);

      await expect(AdminOnlyRequest.from(req as any)).rejects.toThrow(ForbiddenError);
    });
  });

  describe('validated() - error states', () => {
    it('throws when called before validation', () => {
      const req = mockRequest();
      const formReq = new AlwaysAllowRequest(req as any);

      expect(() => formReq.validated()).toThrow('before validation');
    });
  });

  describe('fails() / passes() - error states', () => {
    it('throws when fails() called before validation', () => {
      const req = mockRequest();
      const formReq = new AlwaysAllowRequest(req as any);

      expect(() => formReq.fails()).toThrow('before validation');
    });
  });

  describe('errors() - error states', () => {
    it('throws when errors() called before validation', () => {
      const req = mockRequest();
      const formReq = new AlwaysAllowRequest(req as any);

      expect(() => formReq.errors()).toThrow('before validation');
    });
  });

  describe('helper methods', () => {
    it('user returns req.user', () => {
      const user = mockUser({ id: 'u-1', email: 'a@b.com' });
      const req = mockRequest({ user } as any);
      const formReq = new AlwaysAllowRequest(req as any);

      expect(formReq.user).toEqual(user);
    });

    it('user returns undefined when not authenticated', () => {
      const req = mockRequest();
      const formReq = new AlwaysAllowRequest(req as any);

      expect(formReq.user).toBeUndefined();
    });

    it('requireUser() throws AuthError when no user', () => {
      const req = mockRequest();
      const formReq = new AlwaysAllowRequest(req as any);

      expect(() => formReq.requireUser()).toThrow(AuthError);
    });

    it('requireUser() returns user when authenticated', () => {
      const user = mockUser();
      const req = mockRequest({ user } as any);
      const formReq = new AlwaysAllowRequest(req as any);

      expect(formReq.requireUser()).toEqual(user);
    });

    it('param() returns route param', () => {
      const req = mockRequest({ params: { id: '123' } } as any);
      const formReq = new AlwaysAllowRequest(req as any);

      expect(formReq.param('id')).toBe('123');
    });

    it('param() returns undefined for missing param', () => {
      const req = mockRequest({ params: {} } as any);
      const formReq = new AlwaysAllowRequest(req as any);

      expect(formReq.param('id')).toBeUndefined();
    });

    it('query() returns query param', () => {
      const req = mockRequest({ query: { page: '2' } } as any);
      const formReq = new AlwaysAllowRequest(req as any);

      expect(formReq.query('page')).toBe('2');
    });

    it('query() returns default when not present', () => {
      const req = mockRequest({ query: {} } as any);
      const formReq = new AlwaysAllowRequest(req as any);

      expect(formReq.query('page', '1')).toBe('1');
    });

    it('requestId returns req.requestId', () => {
      const req = mockRequest({ requestId: 'req-abc' } as any);
      const formReq = new AlwaysAllowRequest(req as any);

      expect(formReq.requestId).toBe('req-abc');
    });
  });
});
