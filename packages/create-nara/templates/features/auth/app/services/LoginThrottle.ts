/**
 * Login Throttle Service
 *
 * Tracks failed login attempts and enforces temporary lockouts to prevent
 * brute force attacks. Uses in-memory storage with automatic cleanup.
 *
 * Features:
 * - Track failed attempts per email/phone AND per IP
 * - Configurable max attempts and lockout duration
 * - Automatic cleanup of expired entries
 * - Detailed logging for security monitoring
 *
 * @example
 * // In AuthController.processLogin:
 * const identifier = data.email || data.phone;
 *
 * // Check if locked out
 * if (LoginThrottle.isLockedOut(identifier, request.ip)) {
 *   const remaining = LoginThrottle.getRemainingLockoutTime(identifier, request.ip);
 *   return response.status(429).json({
 *     success: false,
 *     message: `Terlalu banyak percobaan login. Coba lagi dalam ${Math.ceil(remaining / 60000)} menit.`,
 *   });
 * }
 *
 * // On failed login:
 * LoginThrottle.recordFailedAttempt(identifier, request.ip);
 *
 * // On successful login:
 * LoginThrottle.clearAttempts(identifier, request.ip);
 */

import { RATE_LIMIT } from "../config/index.js";
import Logger from "./Logger.js";

/**
 * Login attempt entry
 */
interface LoginAttemptEntry {
  /** Number of failed attempts */
  attempts: number;
  /** Timestamp of first failed attempt in current window */
  firstAttempt: number;
  /** Timestamp when lockout expires (if locked) */
  lockedUntil: number | null;
}

/**
 * In-memory store for login attempts
 * Uses composite keys: "email:identifier" and "ip:address"
 */
const attemptStore = new Map<string, LoginAttemptEntry>();

/**
 * Cleanup interval for expired entries
 */
let cleanupInterval: ReturnType<typeof setInterval> | null = null;

/**
 * Configuration
 */
const config = {
  maxAttempts: RATE_LIMIT.MAX_LOGIN_ATTEMPTS,
  lockoutMs: RATE_LIMIT.LOGIN_LOCKOUT_MS,
  windowMs: RATE_LIMIT.LOGIN_LOCKOUT_MS, // Same as lockout for simplicity
};

/**
 * Start automatic cleanup of expired entries
 */
function startCleanup(): void {
  if (cleanupInterval) return;

  cleanupInterval = setInterval(() => {
    const now = Date.now();

    for (const [key, entry] of attemptStore.entries()) {
      // Remove entries that are past lockout and window
      const expireTime = Math.max(
        entry.firstAttempt + config.windowMs,
        entry.lockedUntil || 0
      );

      if (now > expireTime + 60000) { // Add 1 minute buffer
        attemptStore.delete(key);
      }
    }
  }, 60 * 1000); // Run every minute

  cleanupInterval.unref();
}

// Start cleanup on module load
startCleanup();

/**
 * Get or create entry for a key
 */
function getEntry(key: string): LoginAttemptEntry {
  let entry = attemptStore.get(key);

  if (!entry) {
    entry = {
      attempts: 0,
      firstAttempt: Date.now(),
      lockedUntil: null,
    };
    attemptStore.set(key, entry);
  }

  return entry;
}

/**
 * Check if an identifier or IP is currently locked out
 *
 * @param identifier - Email or phone number
 * @param ip - IP address
 * @returns true if locked out
 */
function isLockedOut(identifier: string, ip: string): boolean {
  const now = Date.now();

  // Check identifier lockout
  const identifierKey = `id:${identifier.toLowerCase()}`;
  const identifierEntry = attemptStore.get(identifierKey);
  if (identifierEntry?.lockedUntil && identifierEntry.lockedUntil > now) {
    return true;
  }

  // Check IP lockout
  const ipKey = `ip:${ip}`;
  const ipEntry = attemptStore.get(ipKey);
  if (ipEntry?.lockedUntil && ipEntry.lockedUntil > now) {
    return true;
  }

  return false;
}

/**
 * Get remaining lockout time in milliseconds
 *
 * @param identifier - Email or phone number
 * @param ip - IP address
 * @returns Remaining lockout time in ms, or 0 if not locked
 */
function getRemainingLockoutTime(identifier: string, ip: string): number {
  const now = Date.now();
  let maxRemaining = 0;

  // Check identifier lockout
  const identifierKey = `id:${identifier.toLowerCase()}`;
  const identifierEntry = attemptStore.get(identifierKey);
  if (identifierEntry?.lockedUntil && identifierEntry.lockedUntil > now) {
    maxRemaining = Math.max(maxRemaining, identifierEntry.lockedUntil - now);
  }

  // Check IP lockout
  const ipKey = `ip:${ip}`;
  const ipEntry = attemptStore.get(ipKey);
  if (ipEntry?.lockedUntil && ipEntry.lockedUntil > now) {
    maxRemaining = Math.max(maxRemaining, ipEntry.lockedUntil - now);
  }

  return maxRemaining;
}

/**
 * Record a failed login attempt
 *
 * @param identifier - Email or phone number
 * @param ip - IP address
 * @returns Object with lockout status and remaining attempts
 */
function recordFailedAttempt(identifier: string, ip: string): {
  isLocked: boolean;
  remainingAttempts: number;
  lockoutMs: number;
} {
  const now = Date.now();

  // Update identifier entry
  const identifierKey = `id:${identifier.toLowerCase()}`;
  const identifierEntry = getEntry(identifierKey);

  // Reset if window expired
  if (now - identifierEntry.firstAttempt > config.windowMs) {
    identifierEntry.attempts = 0;
    identifierEntry.firstAttempt = now;
    identifierEntry.lockedUntil = null;
  }

  identifierEntry.attempts++;

  // Update IP entry
  const ipKey = `ip:${ip}`;
  const ipEntry = getEntry(ipKey);

  // Reset if window expired
  if (now - ipEntry.firstAttempt > config.windowMs) {
    ipEntry.attempts = 0;
    ipEntry.firstAttempt = now;
    ipEntry.lockedUntil = null;
  }

  ipEntry.attempts++;

  // Check if should lock out
  const maxAttempts = Math.max(identifierEntry.attempts, ipEntry.attempts);
  let isLocked = false;
  let lockoutMs = 0;

  if (maxAttempts >= config.maxAttempts) {
    const lockUntil = now + config.lockoutMs;

    // Lock both identifier and IP
    if (identifierEntry.attempts >= config.maxAttempts) {
      identifierEntry.lockedUntil = lockUntil;
    }
    if (ipEntry.attempts >= config.maxAttempts) {
      ipEntry.lockedUntil = lockUntil;
    }

    isLocked = true;
    lockoutMs = config.lockoutMs;

    Logger.logSecurity('Login lockout triggered', {
      identifier,
      ip,
      identifierAttempts: identifierEntry.attempts,
      ipAttempts: ipEntry.attempts,
      lockoutMinutes: Math.ceil(config.lockoutMs / 60000),
    });
  } else {
    Logger.logSecurity('Failed login attempt', {
      identifier,
      ip,
      identifierAttempts: identifierEntry.attempts,
      ipAttempts: ipEntry.attempts,
      remainingAttempts: config.maxAttempts - maxAttempts,
    });
  }

  return {
    isLocked,
    remainingAttempts: Math.max(0, config.maxAttempts - maxAttempts),
    lockoutMs,
  };
}

/**
 * Clear login attempts after successful login
 *
 * @param identifier - Email or phone number
 * @param ip - IP address
 */
function clearAttempts(identifier: string, ip: string): void {
  const identifierKey = `id:${identifier.toLowerCase()}`;
  const ipKey = `ip:${ip}`;

  attemptStore.delete(identifierKey);
  attemptStore.delete(ipKey);
}

/**
 * Get current attempt count for monitoring
 *
 * @param identifier - Email or phone number
 * @param ip - IP address
 * @returns Object with attempt counts
 */
function getAttemptCounts(identifier: string, ip: string): {
  identifierAttempts: number;
  ipAttempts: number;
} {
  const identifierKey = `id:${identifier.toLowerCase()}`;
  const ipKey = `ip:${ip}`;

  return {
    identifierAttempts: attemptStore.get(identifierKey)?.attempts || 0,
    ipAttempts: attemptStore.get(ipKey)?.attempts || 0,
  };
}

/**
 * Get store size for monitoring
 */
function getStoreSize(): number {
  return attemptStore.size;
}

/**
 * Update configuration (useful for testing)
 */
function configure(options: Partial<typeof config>): void {
  Object.assign(config, options);
}

export default {
  isLockedOut,
  getRemainingLockoutTime,
  recordFailedAttempt,
  clearAttempts,
  getAttemptCounts,
  getStoreSize,
  configure,
};
