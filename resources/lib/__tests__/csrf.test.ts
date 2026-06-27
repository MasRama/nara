import { describe, it, expect, beforeEach } from 'vitest';
import { getCSRFToken } from '$lib/csrf';

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
