import { BaseController, jsonSuccess, jsonError } from '@nara-web/core';
import type { NaraRequest, NaraResponse } from '@nara-web/core';
import { UserModel } from '../models/User.js';
import { SessionModel } from '../models/Session.js';
import Authenticate from '../services/Authenticate.js';
import LoginThrottle from '../services/LoginThrottle.js';
import Logger from '../services/Logger.js';
import { randomUUID } from 'crypto';
import { AUTH, ERROR_MESSAGES } from '../config/index.js';

// Session cookie configuration
const SESSION_COOKIE_NAME = 'auth_id';
const SESSION_EXPIRY_MS = 1000 * 60 * 60 * 24 * 60; // 60 days

// Cookie options for auth session
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
};

export class AuthController extends BaseController {
  async login(req: NaraRequest, res: NaraResponse) {
    const { email, password } = await req.json();
    const ip = req.ip || 'unknown';

    if (!email || !password) {
      res.cookie('error', 'Email and password are required', AUTH.ERROR_COOKIE_EXPIRY_MS);
      return res.redirect('/login');
    }

    // Check if locked out due to too many failed attempts
    if (LoginThrottle.isLockedOut(email, ip)) {
      const remainingMs = LoginThrottle.getRemainingLockoutTime(email, ip);
      const remainingMinutes = Math.ceil(remainingMs / 60000);

      Logger.logSecurity('Login blocked - account locked', {
        email,
        ip,
        remainingMinutes,
      });

      res.cookie('error', `Terlalu banyak percobaan login. Coba lagi dalam ${remainingMinutes} menit.`, AUTH.ERROR_COOKIE_EXPIRY_MS);
      return res.redirect('/login');
    }

    Logger.info('Login attempt', {
      email,
      ip,
      userAgent: req.headers['user-agent'],
    });

    // Find user by email
    const user = await UserModel.findByEmail(email);
    if (!user) {
      const throttleResult = LoginThrottle.recordFailedAttempt(email, ip);

      Logger.logSecurity('Login failed - user not found', {
        email,
        ip,
        remainingAttempts: throttleResult.remainingAttempts,
      });

      const errorMsg = throttleResult.isLocked
        ? `Terlalu banyak percobaan login. Coba lagi dalam ${Math.ceil(throttleResult.lockoutMs / 60000)} menit.`
        : ERROR_MESSAGES.INVALID_CREDENTIALS;

      res.cookie('error', errorMsg, AUTH.ERROR_COOKIE_EXPIRY_MS);
      return res.redirect('/login');
    }

    // Verify password using PBKDF2
    const passwordMatch = await Authenticate.compare(password, user.password);
    if (!passwordMatch) {
      const throttleResult = LoginThrottle.recordFailedAttempt(email, ip);

      Logger.logSecurity('Login failed - invalid password', {
        userId: user.id,
        email: user.email,
        ip,
        remainingAttempts: throttleResult.remainingAttempts,
      });

      const errorMsg = throttleResult.isLocked
        ? `Terlalu banyak percobaan login. Coba lagi dalam ${Math.ceil(throttleResult.lockoutMs / 60000)} menit.`
        : ERROR_MESSAGES.INVALID_CREDENTIALS;

      res.cookie('error', errorMsg, AUTH.ERROR_COOKIE_EXPIRY_MS);
      return res.redirect('/login');
    }

    // Successful login - clear attempts
    LoginThrottle.clearAttempts(email, ip);

    Logger.logAuth('login_success', {
      userId: user.id,
      email: user.email,
      ip,
    });

    // Create session in database
    const sessionId = randomUUID();
    await SessionModel.create({
      id: sessionId,
      user_id: user.id,
      user_agent: req.headers['user-agent'] || null,
    });

    // Set session cookie
    res.cookie(SESSION_COOKIE_NAME, sessionId, SESSION_EXPIRY_MS, COOKIE_OPTIONS);

    // Redirect to dashboard
    return res.redirect('/dashboard');
  }

  async register(req: NaraRequest, res: NaraResponse) {
    const { name, email, password } = await req.json();

    if (!name || !email || !password) {
      res.cookie('error', 'Name, email and password are required', AUTH.ERROR_COOKIE_EXPIRY_MS);
      return res.redirect('/register');
    }

    Logger.info('Registration attempt', {
      email,
      name,
      ip: req.ip,
    });

    // Check if email already exists
    const existing = await UserModel.findByEmail(email);
    if (existing) {
      Logger.logSecurity('Registration failed - duplicate email', {
        email,
        ip: req.ip,
      });
      res.cookie('error', ERROR_MESSAGES.EMAIL_EXISTS, AUTH.ERROR_COOKIE_EXPIRY_MS);
      return res.redirect('/register');
    }

    // Hash password using PBKDF2
    const hashedPassword = await Authenticate.hash(password);

    try {
      // Create user in database with UUID
      const userId = randomUUID();
      await UserModel.create({ id: userId, name, email, password: hashedPassword });

      Logger.logAuth('registration_success', {
        userId,
        email,
        ip: req.ip,
      });

      // Create session
      const sessionId = randomUUID();
      await SessionModel.create({
        id: sessionId,
        user_id: userId,
        user_agent: req.headers['user-agent'] || null,
      });

      // Set session cookie
      res.cookie(SESSION_COOKIE_NAME, sessionId, SESSION_EXPIRY_MS, COOKIE_OPTIONS);

      // Redirect to dashboard
      return res.redirect('/dashboard');
    } catch (error: any) {
      Logger.error('Registration failed', error);
      res.cookie('error', ERROR_MESSAGES.INTERNAL_ERROR, AUTH.ERROR_COOKIE_EXPIRY_MS);
      return res.redirect('/register');
    }
  }

  async me(req: NaraRequest, res: NaraResponse) {
    const user = req.user;

    if (!user) {
      return jsonError(res, ERROR_MESSAGES.UNAUTHORIZED, 401);
    }

    return jsonSuccess(res, { user });
  }

  async logout(req: NaraRequest, res: NaraResponse) {
    // Delete session from database
    const sessionId = req.cookies?.[SESSION_COOKIE_NAME];
    if (sessionId) {
      await SessionModel.delete(sessionId);
    }

    // Clear session cookie
    res.cookie(SESSION_COOKIE_NAME, '', 0, COOKIE_OPTIONS);

    Logger.logAuth('logout', {
      userId: req.user?.id,
      ip: req.ip,
    });

    // Redirect to login
    return res.redirect('/login');
  }

  async forgotPassword(req: NaraRequest, res: NaraResponse) {
    const { email } = await req.json();

    if (!email) {
      res.cookie('error', 'Email is required', AUTH.ERROR_COOKIE_EXPIRY_MS);
      return res.redirect('/forgot-password');
    }

    // TODO: Implement password reset (requires email service)

    res.cookie('success', 'If an account exists with this email, a reset link has been sent.', AUTH.ERROR_COOKIE_EXPIRY_MS);
    return res.redirect('/login');
  }

  async resetPassword(req: NaraRequest, res: NaraResponse) {
    const { token, password } = await req.json();

    if (!token || !password) {
      res.cookie('error', 'Reset token and password are required', AUTH.ERROR_COOKIE_EXPIRY_MS);
      return res.redirect('/forgot-password');
    }

    // TODO: Implement password reset (requires email service)

    res.cookie('success', 'Password has been reset successfully.', AUTH.ERROR_COOKIE_EXPIRY_MS);
    return res.redirect('/login');
  }
}

export default new AuthController();
