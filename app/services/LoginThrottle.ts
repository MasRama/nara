import { RATE_LIMIT } from "@config";
import Logger from "@services/Logger";

interface Entry {
  attempts: number;
  firstAttempt: number;
  lockedUntil: number | null;
}

const store = new Map<string, Entry>();

const config = {
  maxAttempts: RATE_LIMIT.MAX_LOGIN_ATTEMPTS,
  lockoutMs: RATE_LIMIT.LOGIN_LOCKOUT_MS,
  windowMs: RATE_LIMIT.LOGIN_LOCKOUT_MS,
};

const cleanup = setInterval(() => {
  const now = Date.now();
  for (const [key, e] of store.entries()) {
    const expire = Math.max(e.firstAttempt + config.windowMs, e.lockedUntil || 0);
    if (now > expire + 60000) store.delete(key);
  }
}, 60_000);
cleanup.unref();

function getEntry(key: string): Entry {
  let entry = store.get(key);
  if (!entry) {
    entry = { attempts: 0, firstAttempt: Date.now(), lockedUntil: null };
    store.set(key, entry);
  }
  return entry;
}

function resetIfExpired(entry: Entry): void {
  const now = Date.now();
  if (now - entry.firstAttempt > config.windowMs) {
    entry.attempts = 0;
    entry.firstAttempt = now;
    entry.lockedUntil = null;
  }
}

function isLockedOut(identifier: string, ip: string): boolean {
  const now = Date.now();
  const idEntry = store.get(`id:${identifier.toLowerCase()}`);
  const ipEntry = store.get(`ip:${ip}`);
  return (idEntry?.lockedUntil != null && idEntry.lockedUntil > now) ||
         (ipEntry?.lockedUntil != null && ipEntry.lockedUntil > now);
}

function getRemainingLockoutTime(identifier: string, ip: string): number {
  const now = Date.now();
  let max = 0;
  const idEntry = store.get(`id:${identifier.toLowerCase()}`);
  const ipEntry = store.get(`ip:${ip}`);
  if (idEntry?.lockedUntil && idEntry.lockedUntil > now) max = Math.max(max, idEntry.lockedUntil - now);
  if (ipEntry?.lockedUntil && ipEntry.lockedUntil > now) max = Math.max(max, ipEntry.lockedUntil - now);
  return max;
}

function recordFailedAttempt(identifier: string, ip: string): {
  isLocked: boolean;
  remainingAttempts: number;
  lockoutMs: number;
} {
  const now = Date.now();
  const idEntry = getEntry(`id:${identifier.toLowerCase()}`);
  const ipEntry = getEntry(`ip:${ip}`);

  resetIfExpired(idEntry);
  resetIfExpired(ipEntry);

  idEntry.attempts++;
  ipEntry.attempts++;

  const maxAttempts = Math.max(idEntry.attempts, ipEntry.attempts);
  let isLocked = false;
  let lockoutMs = 0;

  if (maxAttempts >= config.maxAttempts) {
    const lockUntil = now + config.lockoutMs;
    if (idEntry.attempts >= config.maxAttempts) idEntry.lockedUntil = lockUntil;
    if (ipEntry.attempts >= config.maxAttempts) ipEntry.lockedUntil = lockUntil;
    isLocked = true;
    lockoutMs = config.lockoutMs;
    Logger.logSecurity('Login lockout triggered', {
      identifier, ip,
      identifierAttempts: idEntry.attempts,
      ipAttempts: ipEntry.attempts,
      lockoutMinutes: Math.ceil(config.lockoutMs / 60000),
    });
  } else {
    Logger.logSecurity('Failed login attempt', {
      identifier, ip,
      identifierAttempts: idEntry.attempts,
      ipAttempts: ipEntry.attempts,
      remainingAttempts: config.maxAttempts - maxAttempts,
    });
  }

  return { isLocked, remainingAttempts: Math.max(0, config.maxAttempts - maxAttempts), lockoutMs };
}

function clearAttempts(identifier: string, ip: string): void {
  store.delete(`id:${identifier.toLowerCase()}`);
  store.delete(`ip:${ip}`);
}

function getAttemptCounts(identifier: string, ip: string): { identifierAttempts: number; ipAttempts: number } {
  return {
    identifierAttempts: store.get(`id:${identifier.toLowerCase()}`)?.attempts || 0,
    ipAttempts: store.get(`ip:${ip}`)?.attempts || 0,
  };
}

function configure(options: Partial<typeof config>): void {
  Object.assign(config, options);
}

export default {
  isLockedOut,
  getRemainingLockoutTime,
  recordFailedAttempt,
  clearAttempts,
  getAttemptCounts,
  configure,
};
