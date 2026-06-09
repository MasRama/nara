import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getCSRFToken, buildCSRFHeaders } from '$lib/csrf';

describe('getCSRFToken()', () => {
  beforeEach(() => {
    Object.defineProperty(document, 'cookie', {
      writable: true,
      value: '',
    });
  });

  it('returns undefined when no csrf_token cookie', () => {
    Object.defineProperty(document, 'cookie', { writable: true, value: '' });
    expect(getCSRFToken()).toBeUndefined();
  });

  it('extracts csrf_token from cookie string', () => {
    Object.defineProperty(document, 'cookie', {
      writable: true,
      value: 'session=abc; csrf_token=mytoken123; other=val',
    });
    expect(getCSRFToken()).toBe('mytoken123');
  });
});

describe('buildCSRFHeaders()', () => {
  it('returns empty object when no csrf token', () => {
    Object.defineProperty(document, 'cookie', { writable: true, value: '' });
    expect(buildCSRFHeaders()).toEqual({});
  });

  it('returns X-CSRF-Token header when token present', () => {
    Object.defineProperty(document, 'cookie', {
      writable: true,
      value: 'csrf_token=abc123',
    });
    expect(buildCSRFHeaders()).toEqual({ 'X-CSRF-Token': 'abc123' });
  });
});
