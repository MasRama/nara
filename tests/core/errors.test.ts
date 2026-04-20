import { describe, it, expect } from 'vitest';
import {
  HttpError,
  ValidationError,
  AuthError,
  NotFoundError,
  ForbiddenError,
  BadRequestError,
  ConflictError,
  TooManyRequestsError,
  InternalError,
  isHttpError,
  isValidationError,
} from '../../app/core/errors';

describe('HttpError', () => {
  it('creates with default values', () => {
    const err = new HttpError('Something went wrong');
    expect(err.message).toBe('Something went wrong');
    expect(err.statusCode).toBe(500);
    expect(err.code).toBe('HTTP_ERROR');
    expect(err).toBeInstanceOf(Error);
  });

  it('creates with custom statusCode and code', () => {
    const err = new HttpError('Custom error', 418, 'CUSTOM_CODE');
    expect(err.statusCode).toBe(418);
    expect(err.code).toBe('CUSTOM_CODE');
  });

  it('serializes to JSON', () => {
    const err = new HttpError('Test', 400, 'TEST');
    const json = err.toJSON();
    expect(json).toEqual({ name: 'HttpError', message: 'Test', statusCode: 400, code: 'TEST' });
  });
});

describe('ValidationError', () => {
  it('creates with field errors', () => {
    const errors = { email: ['Email is required'], password: ['Too short'] };
    const err = new ValidationError(errors);
    expect(err.statusCode).toBe(422);
    expect(err.code).toBe('VALIDATION_ERROR');
    expect(err.errors).toEqual(errors);
  });

  it('creates with default message', () => {
    const err = new ValidationError();
    expect(err.message).toBe('Validation failed');
    expect(err.errors).toEqual({});
  });

  it('includes errors in toJSON', () => {
    const errors = { name: ['Required'] };
    const err = new ValidationError(errors, 'Invalid input');
    const json = err.toJSON();
    expect(json.errors).toEqual(errors);
    expect(json.message).toBe('Invalid input');
  });
});

describe('AuthError', () => {
  it('creates with 401 status', () => {
    const err = new AuthError();
    expect(err.statusCode).toBe(401);
    expect(err.code).toBe('AUTH_ERROR');
    expect(err.message).toBe('Unauthorized');
  });

  it('accepts custom message', () => {
    const err = new AuthError('Session expired');
    expect(err.message).toBe('Session expired');
  });
});

describe('NotFoundError', () => {
  it('creates with 404 status', () => {
    const err = new NotFoundError();
    expect(err.statusCode).toBe(404);
    expect(err.code).toBe('NOT_FOUND');
  });
});

describe('ForbiddenError', () => {
  it('creates with 403 status', () => {
    const err = new ForbiddenError();
    expect(err.statusCode).toBe(403);
    expect(err.code).toBe('FORBIDDEN');
  });
});

describe('BadRequestError', () => {
  it('creates with 400 status', () => {
    const err = new BadRequestError();
    expect(err.statusCode).toBe(400);
    expect(err.code).toBe('BAD_REQUEST');
  });
});

describe('ConflictError', () => {
  it('creates with 409 status', () => {
    const err = new ConflictError();
    expect(err.statusCode).toBe(409);
    expect(err.code).toBe('CONFLICT');
  });
});

describe('TooManyRequestsError', () => {
  it('creates with 429 status', () => {
    const err = new TooManyRequestsError();
    expect(err.statusCode).toBe(429);
    expect(err.code).toBe('TOO_MANY_REQUESTS');
  });

  it('includes retryAfter in toJSON when provided', () => {
    const err = new TooManyRequestsError('Slow down', 60);
    expect(err.retryAfter).toBe(60);
    expect(err.toJSON().retryAfter).toBe(60);
  });

  it('does not include retryAfter in toJSON when not provided', () => {
    const err = new TooManyRequestsError();
    expect(err.toJSON().retryAfter).toBeUndefined();
  });
});

describe('InternalError', () => {
  it('creates with 500 status', () => {
    const err = new InternalError();
    expect(err.statusCode).toBe(500);
    expect(err.code).toBe('INTERNAL_ERROR');
  });
});

describe('isHttpError', () => {
  it('returns true for HttpError instances', () => {
    expect(isHttpError(new HttpError('test'))).toBe(true);
    expect(isHttpError(new AuthError())).toBe(true);
    expect(isHttpError(new NotFoundError())).toBe(true);
  });

  it('returns false for plain errors', () => {
    expect(isHttpError(new Error('plain'))).toBe(false);
    expect(isHttpError('string')).toBe(false);
    expect(isHttpError(null)).toBe(false);
  });
});

describe('isValidationError', () => {
  it('returns true for ValidationError instances', () => {
    expect(isValidationError(new ValidationError())).toBe(true);
  });

  it('returns false for other HttpErrors', () => {
    expect(isValidationError(new AuthError())).toBe(false);
    expect(isValidationError(new HttpError('test'))).toBe(false);
  });
});
