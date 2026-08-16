import { describe, it, expect } from 'vitest';
import { isUniqueConstraintError } from '../../app/core/errors';

describe('isUniqueConstraintError', () => {
  it('returns true for SQLite unique constraint errors', () => {
    const error = Object.assign(new Error('UNIQUE constraint failed'), { code: 'SQLITE_CONSTRAINT_UNIQUE' });
    expect(isUniqueConstraintError(error)).toBe(true);
  });

  it('returns false for other errors', () => {
    expect(isUniqueConstraintError(new Error('boom'))).toBe(false);
  });

  it('returns false for non-Error values', () => {
    expect(isUniqueConstraintError({ code: 'SQLITE_CONSTRAINT_UNIQUE' })).toBe(false);
    expect(isUniqueConstraintError(null)).toBe(false);
    expect(isUniqueConstraintError('string')).toBe(false);
  });
});
