/**
 * AuthController
 * 
 * Handles core authentication flows:
 * - Login/Register pages and processing
 * - Logout
 * - Change password
 * 
 * Related controllers:
 * - UserController: User CRUD and profile management
 * - OAuthController: Google OAuth
 */
import Authenticate from '../services/Authenticate.js';
import { User } from '@models';
import LoginThrottle from '../services/LoginThrottle.js';
import Logger from '../services/Logger.js';
import type { NaraRequest, NaraResponse } from '@nara-web/core';
import { BaseController } from '@nara-web/core'; 
import { randomUUID } from 'crypto';
import { LoginSchema, RegisterSchema, ChangePasswordSchema } from '@validators';
import { AUTH, ERROR_MESSAGES } from '@config';

class AuthController extends BaseController {
  /**
   * Register page
   */
  public async registerPage(request: NaraRequest, response: NaraResponse) {
    if (request.cookies.auth_id) {
      const isInertia = request.headers['x-inertia'];
      if (isInertia) {
        return response.status(409).setHeader('X-Inertia-Location', '/dashboard').send('');
      }
      return response.redirect("/dashboard");
    }
    this.requireInertia(response);
    return response.inertia("auth/register");
  }

  /**
   * Login page
   */
  public async loginPage(request: NaraRequest, response: NaraResponse) {
    this.requireInertia(response);
    return response.inertia("auth/login");
  }

  /**
   * Process login
   */
  public async processLogin(request: NaraRequest, response: NaraResponse) {
    const data = await this.getBody(request, LoginSchema);

    const identifier = data.email || data.phone || '';
    const ip = request.ip || 'unknown';

    // Check if locked out due to too many failed attempts
    if (LoginThrottle.isLockedOut(identifier, ip)) {
      const remainingMs = LoginThrottle.getRemainingLockoutTime(identifier, ip);
      const remainingMinutes = Math.ceil(remainingMs / 60000);

      Logger.logSecurity('Login blocked - account locked', {
        identifier,
        ip,
        remainingMinutes,
      });

      return response
        .status(429)
        .cookie("error", `Terlalu banyak percobaan login. Coba lagi dalam ${remainingMinutes} menit.`, AUTH.ERROR_COOKIE_EXPIRY_MS)
        .redirect("/login");
    }

    Logger.info('Login attempt', { 
      identifier: data.email || data.phone,
      type: data.email ? 'email' : 'phone',
      ip: request.ip,
      userAgent: request.headers['user-agent']
    });

    const user = await User.findByEmailOrPhone(data.email, data.phone);

    if (!user) {
      const throttleResult = LoginThrottle.recordFailedAttempt(identifier, ip);

      Logger.logSecurity('Login failed - user not found', {
        identifier,
        ip,
        remainingAttempts: throttleResult.remainingAttempts,
      });

      const errorMsg = throttleResult.isLocked
        ? `Terlalu banyak percobaan login. Coba lagi dalam ${Math.ceil(throttleResult.lockoutMs / 60000)} menit.`
        : ERROR_MESSAGES.INVALID_CREDENTIALS;

      return response
        .cookie("error", errorMsg, AUTH.ERROR_COOKIE_EXPIRY_MS)
        .redirect("/login");
    }

    const password_match = await Authenticate.compare(
      data.password,
      user.password
    );

    if (password_match) {
      LoginThrottle.clearAttempts(identifier, ip);

      Logger.logAuth('login_success', {
        userId: user.id,
        email: user.email,
        ip: request.ip
      });
      return Authenticate.process(user, request, response);
    } else {
      const throttleResult = LoginThrottle.recordFailedAttempt(identifier, ip);

      Logger.logSecurity('Login failed - invalid password', {
        userId: user.id,
        email: user.email,
        ip: request.ip,
        remainingAttempts: throttleResult.remainingAttempts,
      });

      const errorMsg = throttleResult.isLocked
        ? `Terlalu banyak percobaan login. Coba lagi dalam ${Math.ceil(throttleResult.lockoutMs / 60000)} menit.`
        : ERROR_MESSAGES.INVALID_CREDENTIALS;

      return response
        .cookie("error", errorMsg, AUTH.ERROR_COOKIE_EXPIRY_MS)
        .redirect("/login");
    }
  }

  /**
   * Process registration
   */
  public async processRegister(request: NaraRequest, response: NaraResponse) {
    const data = await this.getBody(request, RegisterSchema);

    Logger.info('Registration attempt', {
      email: data.email,
      name: data.name,
      ip: request.ip
    });

    const id = randomUUID();

    try {
      const user = await User.create({
        id: id,
        name: data.name,
        email: data.email,
        phone: data.phone || null,
        password: await Authenticate.hash(data.password),
      });

      Logger.logAuth('registration_success', {
        userId: user.id,
        email: user.email,
        ip: request.ip
      });

      return Authenticate.process(user, request, response);
    } catch (error: any) {
      if (error.code == "SQLITE_CONSTRAINT_UNIQUE") {
        Logger.logSecurity('Registration failed - duplicate email', {
          email: data.email,
          ip: request.ip
        });
        return response
          .cookie("error", ERROR_MESSAGES.EMAIL_EXISTS, AUTH.ERROR_COOKIE_EXPIRY_MS)
          .redirect("/register");
      }
      Logger.error('Registration failed', error);
      throw error;
    }
  }

  /**
   * Logout
   */
  public async logout(request: NaraRequest, response: NaraResponse) {
    if (request.cookies.auth_id) {
      await Authenticate.logout(request, response);
    }
  }

  /**
   * Change password for authenticated user
   */
  public async changePassword(request: NaraRequest, response: NaraResponse) {
    const data = await this.getBody(request, ChangePasswordSchema);
    const user = request.user;

    if (!user) {
      return response.redirect("/login");
    }

    // Get fresh user data with password
    const dbUser = await User.findById(user.id);
    if (!dbUser) {
      return response.redirect("/login");
    }

    // Verify current password
    const passwordMatch = await Authenticate.compare(data.current_password, dbUser.password);
    if (!passwordMatch) {
      return response
        .cookie("error", "Password saat ini tidak valid", AUTH.ERROR_COOKIE_EXPIRY_MS)
        .redirect("/profile");
    }

    // Update password
    const hashedPassword = await Authenticate.hash(data.new_password);
    await User.update(user.id, { password: hashedPassword });

    Logger.logAuth('password_changed', {
      userId: user.id,
      ip: request.ip
    });

    return response
      .cookie("success", "Password berhasil diubah", AUTH.ERROR_COOKIE_EXPIRY_MS)
      .redirect("/profile");
  }
}

export default new AuthController();
