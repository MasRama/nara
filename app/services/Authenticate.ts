/**
 * Authentication Service
 * Handles user authentication operations including password hashing, verification,
 * session management, and login/logout functionality.
 */

import { Session } from "@models"; 
import type { NaraRequest as Request, NaraResponse as Response } from "@core";
import { randomUUID, pbkdf2Sync, randomBytes, timingSafeEqual } from "crypto";

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
 * - httpOnly: Prevents JavaScript access (XSS protection)
 * - secure: Only send over HTTPS (in production)
 * - sameSite: Prevents CSRF attacks
 * - path: Cookie valid for entire site
 */
const getSecureCookieOptions = () => ({
   httpOnly: true,
   secure: process.env.NODE_ENV === 'production',
   sameSite: 'lax' as const,
   path: '/',
});

/**
 * Authentication class providing core authentication functionality
 */
class Autenticate {
   /**
    * Hashes a plain text password using PBKDF2
    * @param {string} password - The plain text password to hash
    * @returns {string} The hashed password with salt (format: salt:hash)
    */
   async hash(password: string) {
      const salt = randomBytes(SALT_SIZE).toString('hex');
      const hash = pbkdf2Sync(password, salt, ITERATIONS, KEYLEN, DIGEST).toString('hex');
      return `${salt}:${hash}`;
   }

   /**
    * Compares a plain text password with a hashed password
    * Uses timing-safe comparison to prevent timing attacks
    * @param {string} password - The plain text password to verify
    * @param {string} storedHash - The stored password hash with salt (format: salt:hash)
    * @returns {boolean} True if passwords match, false otherwise
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
    * @param {Object} user - The user object containing user details
    * @param {Request} request - The HTTP request object
    * @param {Response} response - The HTTP response object
    * 
    * @description
    * 1. Generates a unique session token
    * 2. Creates a session record in the database
    * 3. Sets a secure session cookie with HttpOnly, Secure, SameSite flags
    * 4. Redirects to the home page
    */
   async process(user: any, request: Request, response: Response) {
      const token = randomUUID();

      await Session.createSession({
         id: token,
         user_id: user.id,
         user_agent: request.headers["user-agent"] || null,
      });

      const isInertia = request.headers['x-inertia'];

      if (isInertia) {
         return response
            .cookie(SESSION_COOKIE_NAME, token, SESSION_EXPIRY_MS, getSecureCookieOptions())
            .status(409)
            .setHeader('X-Inertia-Location', '/dashboard')
            .send('');
      }

      response
         .cookie(SESSION_COOKIE_NAME, token, SESSION_EXPIRY_MS, getSecureCookieOptions())
         .redirect("/dashboard");
   }

   /**
    * Handles user logout by removing the session
    * @param {Request} request - The HTTP request object
    * @param {Response} response - The HTTP response object
    * 
    * @description
    * 1. Deletes the session from the database
    * 2. Clears the session cookie with same security options
    * 3. Redirects to the login page
    */
   async logout(request: Request, response: Response) {
      await Session.delete(request.cookies[SESSION_COOKIE_NAME]);

      // Clear cookie with same options to ensure proper deletion
      response
         .cookie(SESSION_COOKIE_NAME, "", 0, getSecureCookieOptions())
         .redirect("/login");
   }
}

// Export a singleton instance
export default new Autenticate();
