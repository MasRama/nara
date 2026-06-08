import { describe, it, expect } from 'vitest';
import { hashPassword, comparePassword } from '../../app/services/Authenticate';

describe('hashPassword', () => {
  it('returns a string in salt:hash format', () => {
    const hash = hashPassword('my-password');
    expect(hash).toMatch(/^[a-f0-9]+:[a-f0-9]+$/);
  });

  it('produces different hashes for same password (random salt)', () => {
    const a = hashPassword('same-password');
    const b = hashPassword('same-password');
    expect(a).not.toBe(b);
  });
});

describe('comparePassword', () => {
  it('returns true for matching password', () => {
    const hash = hashPassword('correct-horse');
    expect(comparePassword('correct-horse', hash)).toBe(true);
  });

  it('returns false for wrong password', () => {
    const hash = hashPassword('correct-horse');
    expect(comparePassword('wrong-password', hash)).toBe(false);
  });

  it('returns false for malformed hash', () => {
    expect(comparePassword('password', 'no-colon')).toBe(false);
    expect(comparePassword('password', '')).toBe(false);
  });
});
