/**
 * Tests for core response helpers
 * 
 * Validates all JSON response helper functions for correct
 * status codes, body structure, and metadata handling.
 */

import { describe, it, expect } from 'vitest';
import { mockResponse } from '../helpers/mocks';
import {
  jsonSuccess,
  jsonError,
  jsonPaginated,
  jsonCreated,
  jsonNoContent,
  jsonUnauthorized,
  jsonForbidden,
  jsonNotFound,
  jsonValidationError,
  jsonServerError,
} from '../../app/core/response';

describe('jsonSuccess', () => {
  it('returns 200 with message only', () => {
    const res = mockResponse();
    jsonSuccess(res as any, 'OK');

    expect(res._status).toBe(200);
    expect(res._body).toEqual({ success: true, message: 'OK' });
  });

  it('includes data when provided', () => {
    const res = mockResponse();
    const data = { id: 1, name: 'Test' };
    jsonSuccess(res as any, 'Found', data);

    expect(res._body).toEqual({
      success: true,
      message: 'Found',
      data,
    });
  });

  it('includes meta when provided', () => {
    const res = mockResponse();
    const meta = { total: 50, page: 1, limit: 10, totalPages: 5, hasNext: true, hasPrev: false };
    jsonSuccess(res as any, 'List', [], meta);

    expect(res._body).toEqual({
      success: true,
      message: 'List',
      data: [],
      meta,
    });
  });

  it('uses custom status code', () => {
    const res = mockResponse();
    jsonSuccess(res as any, 'Created', { id: 1 }, undefined, 201);

    expect(res._status).toBe(201);
  });

  it('omits data key when data is undefined', () => {
    const res = mockResponse();
    jsonSuccess(res as any, 'OK');

    expect(res._body).not.toHaveProperty('data');
  });

  it('omits meta key when meta is undefined', () => {
    const res = mockResponse();
    jsonSuccess(res as any, 'OK', { x: 1 });

    expect(res._body).not.toHaveProperty('meta');
  });

  it('includes data when data is null (explicit null)', () => {
    const res = mockResponse();
    jsonSuccess(res as any, 'OK', null);

    // null !== undefined, so data should not be included
    // Actually: if (data !== undefined) — null passes this check
    expect(res._body).toHaveProperty('data');
    expect(res._body.data).toBeNull();
  });
});

describe('jsonError', () => {
  it('returns error response with default 400 status', () => {
    const res = mockResponse();
    jsonError(res as any, 'Bad request');

    expect(res._status).toBe(400);
    expect(res._body).toEqual({
      success: false,
      message: 'Bad request',
    });
  });

  it('includes error code when provided', () => {
    const res = mockResponse();
    jsonError(res as any, 'Not found', 404, 'NOT_FOUND');

    expect(res._status).toBe(404);
    expect(res._body).toEqual({
      success: false,
      message: 'Not found',
      code: 'NOT_FOUND',
    });
  });

  it('includes field errors when provided', () => {
    const res = mockResponse();
    const errors = { email: ['Required'], name: ['Too short'] };
    jsonError(res as any, 'Validation failed', 422, 'VALIDATION_ERROR', errors);

    expect(res._body.errors).toEqual(errors);
  });

  it('omits code and errors when not provided', () => {
    const res = mockResponse();
    jsonError(res as any, 'Error');

    expect(res._body).not.toHaveProperty('code');
    expect(res._body).not.toHaveProperty('errors');
  });
});

describe('jsonPaginated', () => {
  it('returns paginated response with correct structure', () => {
    const res = mockResponse();
    const data = [{ id: 1 }, { id: 2 }];
    const meta = { total: 20, page: 1, limit: 10, totalPages: 2, hasNext: true, hasPrev: false };

    jsonPaginated(res as any, 'Users retrieved', data, meta);

    expect(res._status).toBe(200);
    expect(res._body).toEqual({
      success: true,
      message: 'Users retrieved',
      data,
      meta,
    });
  });

  it('calculates totalPages when not provided', () => {
    const res = mockResponse();
    const meta = { total: 50, page: 1, limit: 10, totalPages: undefined as any, hasNext: true, hasPrev: false };

    jsonPaginated(res as any, 'OK', [], meta);

    expect(res._body.meta.totalPages).toBe(5);
  });
});

describe('jsonCreated', () => {
  it('returns 201 with data', () => {
    const res = mockResponse();
    const data = { id: 'abc-123', name: 'New Post' };

    jsonCreated(res as any, 'Post created', data);

    expect(res._status).toBe(201);
    expect(res._body).toEqual({
      success: true,
      message: 'Post created',
      data,
    });
  });

  it('works without data', () => {
    const res = mockResponse();
    jsonCreated(res as any, 'Created');

    expect(res._status).toBe(201);
    expect(res._body).toEqual({
      success: true,
      message: 'Created',
    });
  });
});

describe('jsonNoContent', () => {
  it('returns 204 with empty body', () => {
    const res = mockResponse();
    jsonNoContent(res as any);

    expect(res._status).toBe(204);
    expect(res._body).toBe('');
  });
});

describe('jsonUnauthorized', () => {
  it('returns 401 with default message', () => {
    const res = mockResponse();
    jsonUnauthorized(res as any);

    expect(res._status).toBe(401);
    expect(res._body).toEqual({
      success: false,
      message: 'Unauthorized',
      code: 'UNAUTHORIZED',
    });
  });

  it('accepts custom message', () => {
    const res = mockResponse();
    jsonUnauthorized(res as any, 'Session expired');

    expect(res._body.message).toBe('Session expired');
  });
});

describe('jsonForbidden', () => {
  it('returns 403 with default message', () => {
    const res = mockResponse();
    jsonForbidden(res as any);

    expect(res._status).toBe(403);
    expect(res._body.code).toBe('FORBIDDEN');
  });

  it('accepts custom message', () => {
    const res = mockResponse();
    jsonForbidden(res as any, 'Admin only');

    expect(res._body.message).toBe('Admin only');
  });
});

describe('jsonNotFound', () => {
  it('returns 404 with default message', () => {
    const res = mockResponse();
    jsonNotFound(res as any);

    expect(res._status).toBe(404);
    expect(res._body.code).toBe('NOT_FOUND');
    expect(res._body.message).toBe('Not Found');
  });
});

describe('jsonValidationError', () => {
  it('returns 422 with field errors', () => {
    const res = mockResponse();
    const errors = { email: ['Required'], password: ['Too short'] };

    jsonValidationError(res as any, 'Invalid input', errors);

    expect(res._status).toBe(422);
    expect(res._body).toEqual({
      success: false,
      message: 'Invalid input',
      code: 'VALIDATION_ERROR',
      errors,
    });
  });

  it('works without errors', () => {
    const res = mockResponse();
    jsonValidationError(res as any);

    expect(res._status).toBe(422);
    expect(res._body.message).toBe('Validation failed');
  });
});

describe('jsonServerError', () => {
  it('returns 500 with default message', () => {
    const res = mockResponse();
    jsonServerError(res as any);

    expect(res._status).toBe(500);
    expect(res._body).toEqual({
      success: false,
      message: 'Internal Server Error',
      code: 'INTERNAL_ERROR',
    });
  });

  it('accepts custom message', () => {
    const res = mockResponse();
    jsonServerError(res as any, 'DB connection failed');

    expect(res._body.message).toBe('DB connection failed');
  });
});
