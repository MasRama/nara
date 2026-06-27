import { createSession, deleteSession, deleteSessionsByUserId } from '@queries';
import type { User } from '@types';
import type { NaraRequest as Request, NaraResponse as Response } from '@core';
import { randomUUID, pbkdf2Sync, randomBytes, timingSafeEqual } from 'crypto';

const ITERATIONS = 100000;
const KEYLEN = 64;
const DIGEST = 'sha512';
const SALT_SIZE = 16;

const SESSION_COOKIE_NAME = 'auth_id';
const SESSION_EXPIRY_MS = 1000 * 60 * 60 * 24 * 60;

const getSecureCookieOptions = () => ({
   httpOnly: true,
   secure: process.env.NODE_ENV === 'production',
   sameSite: 'lax' as const,
   path: '/',
});

export const hashPassword = (password: string): string => {
   const salt = randomBytes(SALT_SIZE).toString('hex');
   const hash = pbkdf2Sync(password, salt, ITERATIONS, KEYLEN, DIGEST).toString('hex');
   return `${salt}:${hash}`;
};

export const comparePassword = (password: string, storedHash: string): boolean => {
   const [salt, hash] = storedHash.split(':');
   if (!salt || !hash) return false;
   
   const newHash = pbkdf2Sync(password, salt, ITERATIONS, KEYLEN, DIGEST).toString('hex');
   const hashBuffer = Buffer.from(hash, 'hex');
   const newHashBuffer = Buffer.from(newHash, 'hex');
   
   if (hashBuffer.length !== newHashBuffer.length) return false;
   return timingSafeEqual(hashBuffer, newHashBuffer);
};

export const processLogin = (user: User, request: Request, response: Response) => {
   // Prevent session fixation: invalidate all existing sessions for this user
   deleteSessionsByUserId(user.id);

   const token = randomUUID();

   createSession({
      id: token,
      user_id: user.id,
      user_agent: request.headers['user-agent'] || null,
   });

   response.cookie(SESSION_COOKIE_NAME, token, { maxAge: SESSION_EXPIRY_MS, ...getSecureCookieOptions() });
};

export const logout = (request: Request, response: Response) => {
   deleteSession(request.cookies[SESSION_COOKIE_NAME]);
   response.clearCookie(SESSION_COOKIE_NAME, getSecureCookieOptions());
};
