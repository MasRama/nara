import { BaseController, jsonSuccess, jsonError } from '@nara-web/core';
import type { NaraRequest, NaraResponse } from '@nara-web/core';
import { UserModel } from '../models/User.js';
import LoginThrottle from '../services/LoginThrottle.js';
import Logger from '../services/Logger.js';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { AUTH, ERROR_MESSAGES } from '../config/index.js';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const JWT_EXPIRES_SECONDS = AUTH.JWT_EXPIRY_SECONDS;

// Cookie options for auth token
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

    const passwordMatch = await bcrypt.compare(password, user.password);
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

    // Generate JWT token with user info
    const token = jwt.sign(
      { userId: user.id, email: user.email, name: user.name },
      JWT_SECRET,
      { expiresIn: AUTH.JWT_EXPIRY_SECONDS }
    );

    // Set auth cookie for web routes (maxAge in ms)
    res.cookie('auth_token', token, JWT_EXPIRES_SECONDS * 1000, COOKIE_OPTIONS);

    // Redirect to dashboard (Inertia will handle it)
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

    // Hash password
    const hashedPassword = await bcrypt.hash(password, AUTH.BCRYPT_SALT_ROUNDS);

    try {
      // Create user in database
      const [userId] = await UserModel.create({ name, email, password: hashedPassword });

      Logger.logAuth('registration_success', {
        userId,
        email,
        ip: req.ip,
      });

      // Generate JWT token
      const token = jwt.sign(
        { userId, email, name },
        JWT_SECRET,
        { expiresIn: AUTH.JWT_EXPIRY_SECONDS }
      );

      // Set auth cookie for web routes (maxAge in ms)
      res.cookie('auth_token', token, JWT_EXPIRES_SECONDS * 1000, COOKIE_OPTIONS);

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
    // Clear auth cookie (set maxAge to 0)
    res.cookie('auth_token', '', 0, COOKIE_OPTIONS);

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

    // TODO: Implement actual password reset email sending

    // Set success message and redirect
    res.cookie('success', 'If an account exists with this email, a reset link has been sent.', AUTH.ERROR_COOKIE_EXPIRY_MS);
    return res.redirect('/login');
  }

  async resetPassword(req: NaraRequest, res: NaraResponse) {
    const { token, password } = await req.json();

    if (!token || !password) {
      res.cookie('error', 'Reset token and password are required', AUTH.ERROR_COOKIE_EXPIRY_MS);
      return res.redirect('/forgot-password');
    }

    // TODO: Implement actual password reset

    res.cookie('success', 'Password has been reset successfully.', AUTH.ERROR_COOKIE_EXPIRY_MS);
    return res.redirect('/login');
  }
}

export default new AuthController();
