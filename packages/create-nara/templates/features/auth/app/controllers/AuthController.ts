import { BaseController, jsonSuccess, jsonError, ValidationError } from '@nara-web/core';
import type { NaraRequest, NaraResponse } from '@nara-web/core';
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
      throw new ValidationError({ email: ['Email and password are required'] });
    }

    // TODO: Replace with your actual user lookup
    // const user = await UserModel.findByEmail(email);
    // if (!user || !await bcrypt.compare(password, user.password)) {
    //   throw new ValidationError({ email: ['Invalid credentials'] });
    // }

    // Example: Generate JWT token with user info
    const token = jwt.sign(
      { userId: 1, email, name: 'Demo User' },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_SECONDS }
    );

    // Set auth cookie for web routes (maxAge in ms)
    res.cookie('auth_token', token, JWT_EXPIRES_SECONDS * 1000, COOKIE_OPTIONS);

    return jsonSuccess(res, {
      user: { id: 1, email, name: 'Demo User' },
      redirect: '/dashboard'
    }, 'Login successful');
  }

  async register(req: NaraRequest, res: NaraResponse) {
    const { name, email, password } = await req.json();

    if (!name || !email || !password) {
      throw new ValidationError({
        name: !name ? ['Name is required'] : [],
        email: !email ? ['Email is required'] : [],
        password: !password ? ['Password is required'] : [],
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // TODO: Replace with your actual user creation
    // const user = await UserModel.create({ name, email, password: hashedPassword });

    // Generate JWT token
    const token = jwt.sign(
      { userId: 1, email, name },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_SECONDS }
    );

    // Set auth cookie for web routes (maxAge in ms)
    res.cookie('auth_token', token, JWT_EXPIRES_SECONDS * 1000, COOKIE_OPTIONS);

    return jsonSuccess(res, {
      user: { id: 1, email, name },
      redirect: '/dashboard'
    }, 'Registration successful');
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

    return jsonSuccess(res, { redirect: '/login' }, 'Logged out successfully');
  }
}
