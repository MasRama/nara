import { BaseController, jsonSuccess, jsonError } from '@nara-web/core';
import type { NaraRequest, NaraResponse } from '@nara-web/core';
import { UserModel } from '../models/User.js';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const JWT_EXPIRES_SECONDS = 7 * 24 * 60 * 60; // 7 days in seconds

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

    if (!email || !password) {
      // Set error cookie and redirect back (Inertia pattern)
      res.cookie('error', 'Email and password are required', 5000);
      return res.redirect('/login');
    }

    // Find user by email
    const user = await UserModel.findByEmail(email);
    if (!user || !await bcrypt.compare(password, user.password)) {
      res.cookie('error', 'Invalid credentials', 5000);
      return res.redirect('/login');
    }

    // Generate JWT token with user info
    const token = jwt.sign(
      { userId: user.id, email: user.email, name: user.name },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_SECONDS }
    );

    // Set auth cookie for web routes (maxAge in ms)
    res.cookie('auth_token', token, JWT_EXPIRES_SECONDS * 1000, COOKIE_OPTIONS);

    // Redirect to dashboard (Inertia will handle it)
    return res.redirect('/dashboard');
  }

  async register(req: NaraRequest, res: NaraResponse) {
    const { name, email, password } = await req.json();

    if (!name || !email || !password) {
      res.cookie('error', 'Name, email and password are required', 5000);
      return res.redirect('/register');
    }

    // Check if email already exists
    const existing = await UserModel.findByEmail(email);
    if (existing) {
      res.cookie('error', 'Email already registered', 5000);
      return res.redirect('/register');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user in database
    const [userId] = await UserModel.create({ name, email, password: hashedPassword });

    // Generate JWT token
    const token = jwt.sign(
      { userId, email, name },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_SECONDS }
    );

    // Set auth cookie for web routes (maxAge in ms)
    res.cookie('auth_token', token, JWT_EXPIRES_SECONDS * 1000, COOKIE_OPTIONS);

    // Redirect to dashboard
    return res.redirect('/dashboard');
  }

  async me(req: NaraRequest, res: NaraResponse) {
    const user = req.user;

    if (!user) {
      return jsonError(res, 'Unauthorized', 401);
    }

    return jsonSuccess(res, { user });
  }

  async logout(req: NaraRequest, res: NaraResponse) {
    // Clear auth cookie (set maxAge to 0)
    res.cookie('auth_token', '', 0, COOKIE_OPTIONS);

    // Redirect to login
    return res.redirect('/login');
  }

  async forgotPassword(req: NaraRequest, res: NaraResponse) {
    const { email } = await req.json();

    if (!email) {
      res.cookie('error', 'Email is required', 5000);
      return res.redirect('/forgot-password');
    }

    // TODO: Implement actual password reset email sending

    // Set success message and redirect
    res.cookie('success', 'If an account exists with this email, a reset link has been sent.', 5000);
    return res.redirect('/login');
  }

  async resetPassword(req: NaraRequest, res: NaraResponse) {
    const { token, password } = await req.json();

    if (!token || !password) {
      res.cookie('error', 'Reset token and password are required', 5000);
      return res.redirect('/forgot-password');
    }

    // TODO: Implement actual password reset

    res.cookie('success', 'Password has been reset successfully.', 5000);
    return res.redirect('/login');
  }
}
