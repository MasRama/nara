/**
 * Authentication Service
 * Handles user authentication operations including password hashing, verification,
 * session management, and login/logout functionality.
 */

import { SessionModel } from '../models/Session.js';
import type { NaraRequest, NaraResponse } from '@nara-web/core';
import { randomUUID, pbkdf2Sync, randomBytes, timingSafeEqual } from 'crypto';

// PBKDF2 configuration
const ITERATIONS = 100000;
const KEYLEN = 64;
const DIGEST = 'sha512';
const SALT_SIZE = 16;

// Session cookie configuration
const SESSION_COOKIE_NAME = 'auth_id';
const SESSION_EXPIRY_MS = 1000 * 60 * 60 * 24 * 60; // 60 days

/**
 * Secure cookie options
 */
const getSecureCookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
});

class Authenticate {
  /**
   * Hashes a plain text password using PBKDF2
   */
  async hash(password: string) {
    const salt = randomBytes(SALT_SIZE).toString('hex');
    const hash = pbkdf2Sync(password, salt, ITERATIONS, KEYLEN, DIGEST).toString('hex');
    return `${salt}:${hash}`;
  }

  /**
   * Compares a plain text password with a hashed password
   * Uses timing-safe comparison to prevent timing attacks
   */
  async compare(password: string, storedHash: string) {
    const [salt, hash] = storedHash.split(':');
    if (!salt || !hash) return false;

    const newHash = pbkdf2Sync(password, salt, ITERATIONS, KEYLEN, DIGEST).toString('hex');

    // Use timing-safe comparison to prevent timing attacks
    const hashBuffer = Buffer.from(hash, 'hex');
    const newHashBuffer = Buffer.from(newHash, 'hex');

    if (hashBuffer.length !== newHashBuffer.length) return false;

    return timingSafeEqual(hashBuffer, newHashBuffer);
  }

  /**
   * Processes user login by creating a new session
   */
  async process(user: any, request: NaraRequest, response: NaraResponse) {
    const token = randomUUID();

    await SessionModel.create({
      id: token,
      user_id: user.id,
      user_agent: request.headers['user-agent'] || null,
    });

    response
      .cookie(SESSION_COOKIE_NAME, token, SESSION_EXPIRY_MS, getSecureCookieOptions())
      .redirect('/dashboard');
  }

  /**
   * Handles user logout by removing the session
   */
  async logout(request: NaraRequest, response: NaraResponse) {
    await SessionModel.delete(request.cookies[SESSION_COOKIE_NAME]);

    response
      .cookie(SESSION_COOKIE_NAME, '', 0, getSecureCookieOptions())
      .redirect('/login');
  }
}

export default new Authenticate();
