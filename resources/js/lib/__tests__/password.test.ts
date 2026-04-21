import { describe, it, expect } from 'vitest';
import { password_generator } from '$lib/utils/password';

describe('password_generator()', () => {
  it('returns a string of the requested length', () => {
    expect(password_generator(12).length).toBe(12);
    expect(password_generator(8).length).toBe(8);
    expect(password_generator(16).length).toBe(16);
  });

  it('contains at least one lowercase letter', () => {
    const pwd = password_generator(12);
    expect(/[a-z]/.test(pwd)).toBe(true);
  });

  it('contains at least one number', () => {
    const pwd = password_generator(12);
    expect(/[1-9]/.test(pwd)).toBe(true);
  });

  it('contains at least one special character', () => {
    const pwd = password_generator(12);
    expect(/[!@#_]/.test(pwd)).toBe(true);
  });

  it('returns a different password on each call', () => {
    const p1 = password_generator(12);
    const p2 = password_generator(12);
    expect(p1).not.toBe(p2);
  });
});
