import { pbkdf2, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { AUTH } from '../../../shared/config';
import {
  createSession,
  deleteSession,
  deleteSessionsByUserId,
  findUserBySessionId,
  type SessionUser,
  type StoredUser,
} from './repository';

const ITERATIONS = 100_000;
const KEY_LENGTH = 64;
const DIGEST = 'sha512';
const SALT_LENGTH = 16;
const SESSION_COOKIE_NAME = 'auth_id';
const DUMMY_HASH = 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6:' + '0'.repeat(128);

function derivePassword(password: string, salt: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    pbkdf2(password, salt, ITERATIONS, KEY_LENGTH, DIGEST, (error, derivedKey) => {
      if (error) reject(error);
      else resolve(derivedKey);
    });
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_LENGTH).toString('hex');
  const hash = (await derivePassword(password, salt)).toString('hex');
  return `${salt}:${hash}`;
}

export async function comparePassword(password: string, storedHash: string): Promise<boolean> {
  const [salt, hash] = storedHash.split(':');
  if (!salt || !hash) return false;

  const computedBuffer = await derivePassword(password, salt);
  const expectedBuffer = Buffer.from(hash, 'hex');
  if (expectedBuffer.length !== computedBuffer.length) return false;
  return timingSafeEqual(expectedBuffer, computedBuffer);
}

export function checkPassword(password: string, user: StoredUser | undefined): Promise<boolean> {
  return comparePassword(password, user?.password ?? DUMMY_HASH);
}

export function startSession(user: StoredUser, userAgent: string | undefined): string {
  deleteSessionsByUserId(user.id);
  const token = randomUUID();
  createSession({
    id: token,
    userId: user.id,
    userAgent,
    expiresAt: Date.now() + AUTH.SESSION_EXPIRY_MS,
  });
  return token;
}

export function currentUser(sessionId: string | undefined): SessionUser | undefined {
  return sessionId ? findUserBySessionId(sessionId) : undefined;
}

export function endSession(sessionId: string | undefined): void {
  if (sessionId) deleteSession(sessionId);
}

export { SESSION_COOKIE_NAME };
