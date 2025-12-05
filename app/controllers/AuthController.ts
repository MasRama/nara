/**
 * AuthController
 * 
 * Handles core authentication flows:
 * - Login/Register pages and processing
 * - Logout
 * 
 * Related controllers:
 * - UserController: User CRUD and profile management
 * - PasswordController: Password reset and change
 * - OAuthController: Google OAuth
 * - VerificationController: Email verification
 */
import DB from "@services/DB";
import Authenticate from "@services/Authenticate";
import LoginThrottle from "@services/LoginThrottle";
import dayjs from "dayjs";
import Logger from "@services/Logger";
import type { NaraRequest, NaraResponse } from "@core";
import { BaseController } from "@core"; 
import { randomUUID } from "crypto";
import { LoginSchema, RegisterSchema } from "@validators";
import { AUTH, ERROR_MESSAGES } from "@config";

class AuthController extends BaseController {
  /**
   * Register page
   */
  public async registerPage(request: NaraRequest, response: NaraResponse) {
    if (request.cookies.auth_id) {
      return response.redirect("/dashboard");
    }
    return response.inertia("auth/register");
  }

  /**
   * Login page
   */
  public async loginPage(request: NaraRequest, response: NaraResponse) {
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

    let user;

    if (data.email) {
      user = await DB.from("users")
        .where("email", data.email)
        .first();
    } else if (data.phone) {
      user = await DB.from("users").where("phone", data.phone).first();
    }

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
      await DB.table("users").insert({
        id: id,
        name: data.name,
        email: data.email,
        phone: data.phone,
        password: await Authenticate.hash(data.password),
        created_at: dayjs().valueOf(),
        updated_at: dayjs().valueOf(),
      });

      const user = await DB.from("users").where("id", id).first();

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
}

export default new AuthController();
