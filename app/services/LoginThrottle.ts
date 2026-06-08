
import { RATE_LIMIT } from "@config";
import Logger from "@services/Logger";

interface LoginAttemptEntry {
  attempts: number;
  firstAttempt: number;
  lockedUntil: number | null;
}

const attemptStore = new Map<string, LoginAttemptEntry>();

let cleanupInterval: ReturnType<typeof setInterval> | null = null;

const config = {
  maxAttempts: RATE_LIMIT.MAX_LOGIN_ATTEMPTS,
  lockoutMs: RATE_LIMIT.LOGIN_LOCKOUT_MS,
  windowMs: RATE_LIMIT.LOGIN_LOCKOUT_MS,
};

function startCleanup(): void {
  if (cleanupInterval) return;
  
  cleanupInterval = setInterval(() => {
    const now = Date.now();
    
    for (const [key, entry] of attemptStore.entries()) {
      const expireTime = Math.max(
        entry.firstAttempt + config.windowMs,
        entry.lockedUntil || 0
      );
      
      if (now > expireTime + 60000) {
        attemptStore.delete(key);
      }
    }
  }, 60 * 1000);
  
  cleanupInterval.unref();
}

startCleanup();

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

function isLockedOut(identifier: string, ip: string): boolean {
  const now = Date.now();
  
  const identifierKey = `id:${identifier.toLowerCase()}`;
  const identifierEntry = attemptStore.get(identifierKey);
  if (identifierEntry?.lockedUntil && identifierEntry.lockedUntil > now) {
    return true;
  }
  
  const ipKey = `ip:${ip}`;
  const ipEntry = attemptStore.get(ipKey);
  if (ipEntry?.lockedUntil && ipEntry.lockedUntil > now) {
    return true;
  }
  
  return false;
}

function getRemainingLockoutTime(identifier: string, ip: string): number {
  const now = Date.now();
  let maxRemaining = 0;
  
  const identifierKey = `id:${identifier.toLowerCase()}`;
  const identifierEntry = attemptStore.get(identifierKey);
  if (identifierEntry?.lockedUntil && identifierEntry.lockedUntil > now) {
    maxRemaining = Math.max(maxRemaining, identifierEntry.lockedUntil - now);
  }
  
  const ipKey = `ip:${ip}`;
  const ipEntry = attemptStore.get(ipKey);
  if (ipEntry?.lockedUntil && ipEntry.lockedUntil > now) {
    maxRemaining = Math.max(maxRemaining, ipEntry.lockedUntil - now);
  }
  
  return maxRemaining;
}

function recordFailedAttempt(identifier: string, ip: string): {
  isLocked: boolean;
  remainingAttempts: number;
  lockoutMs: number;
} {
  const now = Date.now();
  
  const identifierKey = `id:${identifier.toLowerCase()}`;
  const identifierEntry = getEntry(identifierKey);
  
  if (now - identifierEntry.firstAttempt > config.windowMs) {
    identifierEntry.attempts = 0;
    identifierEntry.firstAttempt = now;
    identifierEntry.lockedUntil = null;
  }
  
  identifierEntry.attempts++;
  
  const ipKey = `ip:${ip}`;
  const ipEntry = getEntry(ipKey);
  
  if (now - ipEntry.firstAttempt > config.windowMs) {
    ipEntry.attempts = 0;
    ipEntry.firstAttempt = now;
    ipEntry.lockedUntil = null;
  }
  
  ipEntry.attempts++;
  
  const maxAttempts = Math.max(identifierEntry.attempts, ipEntry.attempts);
  let isLocked = false;
  let lockoutMs = 0;
  
  if (maxAttempts >= config.maxAttempts) {
    const lockUntil = now + config.lockoutMs;
    
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

function clearAttempts(identifier: string, ip: string): void {
  const identifierKey = `id:${identifier.toLowerCase()}`;
  const ipKey = `ip:${ip}`;
  
  attemptStore.delete(identifierKey);
  attemptStore.delete(ipKey);
}

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

function getStoreSize(): number {
  return attemptStore.size;
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
  getStoreSize,
  configure,
};
