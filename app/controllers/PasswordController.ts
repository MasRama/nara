/**
 * PasswordController
 * 
 * Handles password-related operations:
 * - Forgot password page and email/SMS sending
 * - Reset password page and processing
 * - Change password for authenticated users
 */
import DB from "@services/DB";
import Authenticate from "@services/Authenticate";
import axios from "axios";
import dayjs from "dayjs";
import Mailer from "@services/Mailer";
import Logger from "@services/Logger";
import type { NaraRequest, NaraResponse } from "@core";
import { 
  BaseController,
  jsonSuccess, 
  jsonError, 
  jsonNotFound,
} from "@core"; 
import { randomUUID } from "crypto";
import { 
  ChangePasswordSchema,
  ForgotPasswordSchema,
  ResetPasswordSchema,
} from "@validators";
import { AUTH } from "@config";

class PasswordController extends BaseController {
  /**
   * Forgot password page
   */
  public async forgotPasswordPage(request: NaraRequest, response: NaraResponse) {
    return response.inertia("auth/forgot-password");
  }

  /**
   * Reset password page - validates token before showing form
   */
  public async resetPasswordPage(request: NaraRequest, response: NaraResponse) {
    const id = request.params.id;

    const token = await DB.from("password_reset_tokens")
      .where("token", id)
      .where("expires_at", ">", new Date())
      .first();

    if (!token) {
      return response.status(404).send("Link tidak valid atau sudah kadaluarsa");
    }

    return response.inertia("auth/reset-password", { id: request.params.id });
  }

  /**
   * Process password reset
   */
  public async resetPassword(request: NaraRequest, response: NaraResponse) {
    const data = await this.getBody(request, ResetPasswordSchema);

    const token = await DB.from("password_reset_tokens")
      .where("token", data.id)
      .where("expires_at", ">", new Date())
      .first();

    if (!token) {
      return jsonNotFound(response, "Link tidak valid atau sudah kadaluarsa");
    }

    const user = await DB.from("users")
      .where("email", token.email)
      .first();

    await DB.from("users")
      .where("id", user.id)
      .update({ 
        password: await Authenticate.hash(data.password),
        updated_at: dayjs().valueOf(),
      });

    // Delete the used token
    await DB.from("password_reset_tokens")
      .where("token", data.id)
      .delete();

    return Authenticate.process(user, request, response);
  }

  /**
   * Send password reset link via email/SMS
   */
  public async sendResetPassword(request: NaraRequest, response: NaraResponse) {
    const data = await this.getBody(request, ForgotPasswordSchema);

    let user;

    if (data.email) {
      user = await DB.from("users").where("email", data.email).first();
    } else if (data.phone) {
      user = await DB.from("users").where("phone", data.phone).first();
    }

    if (!user) {
      return jsonNotFound(response, "Email atau nomor telepon tidak terdaftar");
    }

    const token = randomUUID();

    // Store token in database with 24-hour expiration
    await DB.from("password_reset_tokens").insert({
      email: user.email,
      token: token,
      expires_at: dayjs().add(AUTH.TOKEN_EXPIRY_HOURS, 'hours').toDate()
    });

    // Send email
    try {
      if (user.email) {
        await Mailer.sendMail({
          from: process.env.USER_MAILER,
          to: user.email,
          subject: "Reset Password",
          text: `Anda telah meminta reset password. Jika ini adalah Anda, silakan klik link berikut:

${process.env.APP_URL}/reset-password/${token}

Jika Anda tidak meminta reset password, abaikan email ini.

Link ini akan kadaluarsa dalam 24 jam.`,
        });
      }
    } catch (error) {
      Logger.error('Failed to send reset password email', error as Error);
    }

    // Send SMS
    try {
      if (user.phone) {
        await axios.post("https://api.dripsender.id/send", {
          api_key: process.env.DRIPSENDER_API_KEY || "DRIPSENDER_API_KEY",
          phone: user.phone,
          text: `Anda telah meminta reset password. Klik link berikut:

${process.env.APP_URL}/reset-password/${token}

Abaikan jika bukan Anda. Link kadaluarsa dalam 24 jam.`,
        });
      }
    } catch (error) {
      Logger.error('Failed to send reset password SMS', error as Error);
    }

    return jsonSuccess(response, "Link reset password telah dikirim");
  }

  /**
   * Change password for authenticated user
   */
  public async changePassword(request: NaraRequest, response: NaraResponse) {
    this.requireAuth(request);
    const data = await this.getBody(request, ChangePasswordSchema);

    const user = await DB.from("users")
      .where("id", request.user.id)
      .first();

    const password_match = await Authenticate.compare(
      data.current_password,
      user.password
    );

    if (password_match) {
      await DB.from("users")
        .where("id", request.user.id)
        .update({
          password: await Authenticate.hash(data.new_password),
          updated_at: dayjs().valueOf(),
        });

      Logger.logAuth('password_changed', {
        userId: request.user.id,
        email: request.user.email,
        ip: request.ip
      });

      return jsonSuccess(response, "Password berhasil diubah");
    } else {
      Logger.logSecurity('Password change failed - invalid current password', {
        userId: request.user.id,
        ip: request.ip
      });
      return jsonError(response, "Password lama tidak cocok", 400, "INVALID_PASSWORD");
    }
  }
}

export default new PasswordController();
