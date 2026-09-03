import { env } from '../../../shared/config';
import { Logger } from '../../../shared/logging';

interface ThrottleEntry {
  attempts: number;
  firstAttempt: number;
  lockedUntil: number | null;
}

interface ThrottleConfig {
  maxAttempts: number;
  lockoutMs: number;
  windowMs: number;
  now: () => number;
}

const store = new Map<string, ThrottleEntry>();

/**
 * Hard ceiling on throttle keys. Creation is already gated by the global and
 * auth rate limiters, and entries expire after the lockout window + 60s, but
 * identifier rotation (`id:<email>`) is attacker-controlled so expiry alone
 * cannot bound cardinality. Evicting the oldest key first keeps memory bounded
 * without a cache framework; eviction only forgives an old bucket.
 */
const MAX_THROTTLE_KEYS = 10_000;

let lastSweep = Date.now();

function config(now: () => number = Date.now): ThrottleConfig {
  return {
    maxAttempts: env.AUTH_LOCKOUT_ATTEMPTS,
    lockoutMs: env.AUTH_LOCKOUT_WINDOW_MS,
    windowMs: env.AUTH_LOCKOUT_WINDOW_MS,
    now,
  };
}

function sweep(currentTime: number, windowMs: number): void {
  if (currentTime - lastSweep < windowMs) return;
  lastSweep = currentTime;
  for (const [key, entry] of store) {
    const expiry = Math.max(entry.firstAttempt + windowMs, entry.lockedUntil ?? 0);
    if (currentTime > expiry + 60_000) store.delete(key);
  }
}

function entryFor(key: string, currentTime: number): ThrottleEntry {
  const existing = store.get(key);
  if (existing) return existing;
  while (store.size >= MAX_THROTTLE_KEYS) {
    const oldest = store.keys().next().value;
    if (oldest === undefined) break;
    store.delete(oldest);
  }
  const created: ThrottleEntry = { attempts: 0, firstAttempt: currentTime, lockedUntil: null };
  store.set(key, created);
  return created;
}

function resetIfExpired(entry: ThrottleEntry, currentTime: number, windowMs: number): void {
  if (currentTime - entry.firstAttempt > windowMs) {
    entry.attempts = 0;
    entry.firstAttempt = currentTime;
    entry.lockedUntil = null;
  }
}

/** Normalized login identifier: surrounding whitespace and case never create separate buckets. */
export function normalizeLoginIdentifier(identifier: string): string {
  return identifier.trim().toLowerCase();
}

function keys(identifier: string, ip: string): [string, string] {
  return [`id:${normalizeLoginIdentifier(identifier)}`, `ip:${ip}`];
}

export function isLockedOut(identifier: string, ip: string, now: () => number = Date.now): boolean {
  const currentTime = now();
  const { windowMs } = config(now);
  sweep(currentTime, windowMs);
  const [idKey, ipKey] = keys(identifier, ip);
  return (
    (store.get(idKey)?.lockedUntil ?? 0) > currentTime || (store.get(ipKey)?.lockedUntil ?? 0) > currentTime
  );
}

export function remainingLockoutMs(identifier: string, ip: string, now: () => number = Date.now): number {
  const currentTime = now();
  const [idKey, ipKey] = keys(identifier, ip);
  const idRemaining = Math.max(0, (store.get(idKey)?.lockedUntil ?? 0) - currentTime);
  const ipRemaining = Math.max(0, (store.get(ipKey)?.lockedUntil ?? 0) - currentTime);
  return Math.max(idRemaining, ipRemaining);
}

export function recordFailedAttempt(
  identifier: string,
  ip: string,
  now: () => number = Date.now,
): { isLocked: boolean; lockoutMs: number } {
  const { maxAttempts, lockoutMs, windowMs } = config(now);
  const currentTime = now();
  sweep(currentTime, windowMs);
  const [idKey, ipKey] = keys(identifier, ip);
  const idEntry = entryFor(idKey, currentTime);
  const ipEntry = entryFor(ipKey, currentTime);
  resetIfExpired(idEntry, currentTime, windowMs);
  resetIfExpired(ipEntry, currentTime, windowMs);
  idEntry.attempts += 1;
  ipEntry.attempts += 1;

  // Either dimension reaching the threshold locks that dimension. Attackers
  // cannot bypass lockout by rotating IPs for one email, nor by rotating
  // emails behind one IP.
  if (Math.max(idEntry.attempts, ipEntry.attempts) >= maxAttempts) {
    const lockUntil = currentTime + lockoutMs;
    if (idEntry.attempts >= maxAttempts) idEntry.lockedUntil = lockUntil;
    if (ipEntry.attempts >= maxAttempts) ipEntry.lockedUntil = lockUntil;
    Logger.logSecurity('Login lockout triggered', {
      ip,
      identifierAttempts: idEntry.attempts,
      ipAttempts: ipEntry.attempts,
    });
    return { isLocked: true, lockoutMs };
  }
  return { isLocked: false, lockoutMs: 0 };
}

export function clearLoginAttempts(identifier: string, ip: string): void {
  const [idKey, ipKey] = keys(identifier, ip);
  store.delete(idKey);
  store.delete(ipKey);
}

/** Test-only reset for deterministic lockout suites. */
export function resetLoginThrottle(): void {
  store.clear();
  lastSweep = Date.now();
}
