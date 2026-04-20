import { describe, it, expect } from 'vitest';
import {
  isString,
  isEmail,
  isPhone,
  isUUID,
  isNumber,
  isBoolean,
  isArray,
  isObject,
  formatErrors,
} from '../../app/validators/validate';

describe('isString', () => {
  it('returns true for strings', () => {
    expect(isString('hello')).toBe(true);
    expect(isString('')).toBe(true);
  });

  it('returns false for non-strings', () => {
    expect(isString(123)).toBe(false);
    expect(isString(null)).toBe(false);
    expect(isString(undefined)).toBe(false);
    expect(isString({})).toBe(false);
  });
});

describe('isEmail', () => {
  it('validates correct emails', () => {
    expect(isEmail('user@example.com')).toBe(true);
    expect(isEmail('user+tag@example.co.id')).toBe(true);
    expect(isEmail('a@b.io')).toBe(true);
  });

  it('rejects invalid emails', () => {
    expect(isEmail('notanemail')).toBe(false);
    expect(isEmail('@nodomain.com')).toBe(false);
    expect(isEmail('no@')).toBe(false);
    expect(isEmail('')).toBe(false);
    expect(isEmail(123)).toBe(false);
  });
});

describe('isPhone', () => {
  it('validates correct phone numbers', () => {
    expect(isPhone('08123456789')).toBe(true);
    expect(isPhone('+628123456789')).toBe(true);
    expect(isPhone('021-555-1234')).toBe(true);
  });

  it('rejects invalid phone numbers', () => {
    expect(isPhone('short')).toBe(false);
    expect(isPhone('12345')).toBe(false),
    expect(isPhone('abc123')).toBe(false);
    expect(isPhone(123)).toBe(false);
  });
});

describe('isUUID', () => {
  it('validates valid UUIDs', () => {
    expect(isUUID('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
    expect(isUUID('6ba7b810-9dad-11d1-80b4-00c04fd430c8')).toBe(true);
  });

  it('rejects invalid UUIDs', () => {
    expect(isUUID('not-a-uuid')).toBe(false);
    expect(isUUID('550e8400-e29b-41d4-a716')).toBe(false);
    expect(isUUID('')).toBe(false);
    expect(isUUID(123)).toBe(false);
  });
});

describe('isNumber', () => {
  it('returns true for numbers', () => {
    expect(isNumber(0)).toBe(true);
    expect(isNumber(42)).toBe(true);
    expect(isNumber(-1.5)).toBe(true);
  });

  it('returns false for non-numbers', () => {
    expect(isNumber(NaN)).toBe(false);
    expect(isNumber('42')).toBe(false);
    expect(isNumber(null)).toBe(false);
  });
});

describe('isBoolean', () => {
  it('returns true for booleans', () => {
    expect(isBoolean(true)).toBe(true);
    expect(isBoolean(false)).toBe(true);
  });

  it('returns false for non-booleans', () => {
    expect(isBoolean(1)).toBe(false);
    expect(isBoolean('true')).toBe(false);
    expect(isBoolean(null)).toBe(false);
  });
});

describe('isArray', () => {
  it('returns true for arrays', () => {
    expect(isArray([])).toBe(true);
    expect(isArray([1, 2, 3])).toBe(true);
  });

  it('returns false for non-arrays', () => {
    expect(isArray({})).toBe(false);
    expect(isArray('string')).toBe(false);
    expect(isArray(null)).toBe(false);
  });
});

describe('isObject', () => {
  it('returns true for plain objects', () => {
    expect(isObject({})).toBe(true);
    expect(isObject({ a: 1 })).toBe(true);
  });

  it('returns false for non-objects', () => {
    expect(isObject([])).toBe(false);
    expect(isObject(null)).toBe(false);
    expect(isObject('string')).toBe(false);
    expect(isObject(42)).toBe(false);
  });
});

describe('formatErrors', () => {
  it('formats field errors', () => {
    const result = formatErrors({ email: ['Email required'], name: ['Too short'] });
    expect(result).toContain('email: Email required');
    expect(result).toContain('name: Too short');
  });

  it('formats _root errors without field prefix', () => {
    const result = formatErrors({ _root: ['Something went wrong'] });
    expect(result).toBe('Something went wrong');
  });

  it('handles multiple errors per field', () => {
    const result = formatErrors({ password: ['Too short', 'Needs number'] });
    expect(result).toBe('password: Too short, Needs number');
  });

  it('handles empty errors object', () => {
    const result = formatErrors({});
    expect(result).toBe('');
  });
});
