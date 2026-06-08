import { describe, it, expect, beforeEach } from 'vitest';
import LoginThrottle from '../../app/services/LoginThrottle';

describe('LoginThrottle', () => {
  const email = 'test@test.com';
  const ip = '127.0.0.1';

  beforeEach(() => {
    LoginThrottle.clearAttempts(email, ip);
    LoginThrottle.configure({ maxAttempts: 3, lockoutMs: 1000, windowMs: 1000 });
  });

  it('should not be locked out initially', () => {
    expect(LoginThrottle.isLockedOut(email, ip)).toBe(false);
  });

  it('should lock out after max attempts', () => {
    LoginThrottle.recordFailedAttempt(email, ip);
    LoginThrottle.recordFailedAttempt(email, ip);
    LoginThrottle.recordFailedAttempt(email, ip);
    
    expect(LoginThrottle.isLockedOut(email, ip)).toBe(true);
  });

  it('should track attempt counts', () => {
    LoginThrottle.recordFailedAttempt(email, ip);
    LoginThrottle.recordFailedAttempt(email, ip);
    
    const counts = LoginThrottle.getAttemptCounts(email, ip);
    expect(counts.identifierAttempts).toBe(2);
    expect(counts.ipAttempts).toBe(2);
  });

  it('should clear attempts', () => {
    LoginThrottle.recordFailedAttempt(email, ip);
    LoginThrottle.recordFailedAttempt(email, ip);
    LoginThrottle.recordFailedAttempt(email, ip);
    
    LoginThrottle.clearAttempts(email, ip);
    
    expect(LoginThrottle.isLockedOut(email, ip)).toBe(false);
    expect(LoginThrottle.getAttemptCounts(email, ip).identifierAttempts).toBe(0);
  });

  it('should return remaining lockout time when locked', () => {
    LoginThrottle.recordFailedAttempt(email, ip);
    LoginThrottle.recordFailedAttempt(email, ip);
    LoginThrottle.recordFailedAttempt(email, ip);
    
    const remaining = LoginThrottle.getRemainingLockoutTime(email, ip);
    expect(remaining).toBeGreaterThan(0);
    expect(remaining).toBeLessThanOrEqual(1000);
  });

  it('should return 0 lockout time when not locked', () => {
    expect(LoginThrottle.getRemainingLockoutTime(email, ip)).toBe(0);
  });

  it('should return lockout info from recordFailedAttempt', () => {
    const result = LoginThrottle.recordFailedAttempt(email, ip);
    expect(result.isLocked).toBe(false);
    expect(result.remainingAttempts).toBe(2);
  });

  it('should return isLocked true on third attempt', () => {
    LoginThrottle.recordFailedAttempt(email, ip);
    LoginThrottle.recordFailedAttempt(email, ip);
    const result = LoginThrottle.recordFailedAttempt(email, ip);
    
    expect(result.isLocked).toBe(true);
    expect(result.remainingAttempts).toBe(0);
    expect(result.lockoutMs).toBeGreaterThan(0);
  });

  it('should track separate IPs independently', () => {
    LoginThrottle.recordFailedAttempt(email, '1.1.1.1');
    LoginThrottle.recordFailedAttempt(email, '1.1.1.1');
    LoginThrottle.recordFailedAttempt(email, '1.1.1.1');
    
    expect(LoginThrottle.isLockedOut(email, '1.1.1.1')).toBe(true);
    expect(LoginThrottle.isLockedOut('other@test.com', '2.2.2.2')).toBe(false);
  });
});
