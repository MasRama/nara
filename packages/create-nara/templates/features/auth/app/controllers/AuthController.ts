import { BaseController, jsonSuccess, jsonError, ValidationError } from '@nara-web/core';
import type { NaraRequest, NaraResponse } from '@nara-web/core';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

export class AuthController extends BaseController {
  async login(req: NaraRequest, res: NaraResponse) {
    const { email, password } = await req.json();

    if (!email || !password) {
      throw new ValidationError({ email: ['Email and password are required'] });
    }

    // TODO: Replace with your actual user lookup
    // const user = await User.findByEmail(email);
    // if (!user || !await bcrypt.compare(password, user.password)) {
    //   return jsonError(res, 'Invalid credentials', 401);
    // }

    // Example: Generate JWT token
    const token = jwt.sign({ userId: 1, email }, JWT_SECRET, { expiresIn: '7d' });

    return jsonSuccess(res, { token, message: 'Login successful' });
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
    // const user = await User.create({ name, email, password: hashedPassword });

    const token = jwt.sign({ userId: 1, email }, JWT_SECRET, { expiresIn: '7d' });

    return jsonSuccess(res, { token }, 'Registration successful');
  }

  async me(req: NaraRequest, res: NaraResponse) {
    // TODO: Get user from JWT token in auth middleware
    const user = req.user;

    if (!user) {
      return jsonError(res, 'Unauthorized', 401);
    }

    return jsonSuccess(res, { user });
  }

  async logout(req: NaraRequest, res: NaraResponse) {
    // For JWT, logout is typically handled client-side by removing the token
    return jsonSuccess(res, { message: 'Logged out successfully' });
  }
}
