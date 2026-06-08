import { describe, it, expect } from 'vitest';
import {
  httpError,
  validationError,
  authError,
  notFoundError,
  forbiddenError,
  badRequestError,
  conflictError,
  tooManyRequestsError,
  internalError,
  isNaraError,
  isValidationError,
} from '../../app/core/errors';

describe('httpError', () => {
  it('creates with default values', () => {
    const err = httpError('Something went wrong');
    expect(err.message).toBe('Something went wrong');
    expect(err.statusCode).toBe(500);
    expect(err.code).toBe('HTTP_ERROR');
    expect(err.__nara).toBe(true);
  });

  it('creates with custom statusCode and code', () => {
    const err = httpError('Custom error', 418, 'CUSTOM_CODE');
    expect(err.statusCode).toBe(418);
    expect(err.code).toBe('CUSTOM_CODE');
  });
});

describe('validationError', () => {
  it('creates with field errors', () => {
    const errors = { email: ['Email is required'], password: ['Too short'] };
    const err = validationError(errors);
    expect(err.statusCode).toBe(422);
    expect(err.code).toBe('VALIDATION_ERROR');
    expect(err.errors).toEqual(errors);
  });

  it('creates with default message', () => {
    const err = validationError();
    expect(err.message).toBe('Validation failed');
    expect(err.errors).toEqual({});
  });

  it('accepts custom message', () => {
    const err = validationError({ name: ['Required'] }, 'Invalid input');
    expect(err.message).toBe('Invalid input');
    expect(err.errors).toEqual({ name: ['Required'] });
  });
});

describe('authError', () => {
  it('creates with 401 status', () => {
    const err = authError();
    expect(err.statusCode).toBe(401);
    expect(err.code).toBe('AUTH_ERROR');
    expect(err.message).toBe('Unauthorized');
  });

  it('accepts custom message', () => {
    const err = authError('Session expired');
    expect(err.message).toBe('Session expired');
  });
});

describe('notFoundError', () => {
  it('creates with 404 status', () => {
    const err = notFoundError();
    expect(err.statusCode).toBe(404);
    expect(err.code).toBe('NOT_FOUND');
  });
});

describe('forbiddenError', () => {
  it('creates with 403 status', () => {
    const err = forbiddenError();
    expect(err.statusCode).toBe(403);
    expect(err.code).toBe('FORBIDDEN');
  });
});

describe('badRequestError', () => {
  it('creates with 400 status', () => {
    const err = badRequestError();
    expect(err.statusCode).toBe(400);
    expect(err.code).toBe('BAD_REQUEST');
  });
});

describe('conflictError', () => {
  it('creates with 409 status', () => {
    const err = conflictError();
    expect(err.statusCode).toBe(409);
    expect(err.code).toBe('CONFLICT');
  });
});

describe('tooManyRequestsError', () => {
  it('creates with 429 status', () => {
    const err = tooManyRequestsError();
    expect(err.statusCode).toBe(429);
    expect(err.code).toBe('TOO_MANY_REQUESTS');
  });

  it('includes retryAfter when provided', () => {
    const err = tooManyRequestsError('Slow down', 60);
    expect(err.retryAfter).toBe(60);
  });

  it('does not include retryAfter when not provided', () => {
    const err = tooManyRequestsError();
    expect(err.retryAfter).toBeUndefined();
  });
});

describe('internalError', () => {
  it('creates with 500 status', () => {
    const err = internalError();
    expect(err.statusCode).toBe(500);
    expect(err.code).toBe('INTERNAL_ERROR');
  });
});

describe('isNaraError', () => {
  it('returns true for all Nara errors', () => {
    expect(isNaraError(httpError('test'))).toBe(true);
    expect(isNaraError(authError())).toBe(true);
    expect(isNaraError(notFoundError())).toBe(true);
    expect(isNaraError(validationError())).toBe(true);
    expect(isNaraError(forbiddenError())).toBe(true);
  });

  it('returns false for plain errors', () => {
    expect(isNaraError(new Error('plain'))).toBe(false);
    expect(isNaraError('string')).toBe(false);
    expect(isNaraError(null)).toBe(false);
    expect(isNaraError(undefined)).toBe(false);
    expect(isNaraError({})).toBe(false);
  });
});

describe('isValidationError', () => {
  it('returns true for validation errors', () => {
    expect(isValidationError(validationError())).toBe(true);
    expect(isValidationError(validationError({ name: ['Required'] }))).toBe(true);
  });

  it('returns false for other Nara errors', () => {
    expect(isValidationError(authError())).toBe(false);
    expect(isValidationError(httpError('test'))).toBe(false);
    expect(isValidationError(notFoundError())).toBe(false);
  });
});
