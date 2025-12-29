/**
 * VerificationController
 * 
 * Handles email verification:
 * - Send verification email
 * - Verify email token
 */
import { User, EmailVerificationToken } from "@models";
import dayjs from "dayjs";
import Mailer from "@services/Mailer";
import Logger from "@services/Logger";
import type { NaraRequest, NaraResponse } from "@core";
import { BaseController } from "@core"; 
import { randomUUID } from "crypto";
import { AUTH } from "@config";

class VerificationController extends BaseController {
  /**
   * Send verification email
   */
  public async sendVerification(request: NaraRequest, response: NaraResponse) {
    this.requireAuth(request);

    const token = randomUUID();

    // Delete any existing verification tokens for this user
    await EmailVerificationToken.deleteByUserId(request.user.id);

    // Create new verification token
    await EmailVerificationToken.createToken({
      user_id: request.user.id,
      token: token,
      expires_at: dayjs().add(AUTH.TOKEN_EXPIRY_HOURS, 'hours').toDate()
    });

    try {
      await Mailer.sendMail({
        from: process.env.USER_MAILER,
        to: request.user.email,
        subject: "Verifikasi Akun",
        text: `Klik link berikut untuk verifikasi email anda:
${process.env.APP_URL}/verify/${token}

Link ini akan kadaluarsa dalam 24 jam.`,
      });
    } catch (error) {
      Logger.error('Failed to send verification email', error as Error);
      return response.redirect("/dashboard");
    }

    return response.redirect("/dashboard");
  }

  /**
   * Verify email token
   */
  public async verifyEmail(request: NaraRequest, response: NaraResponse) {
    this.requireAuth(request);

    const { id } = request.params;

    const verificationToken = await EmailVerificationToken.findValidToken(request.user.id, id);

    if (verificationToken) {
      await User.verifyEmail(request.user.id);

      // Delete the used token
      await EmailVerificationToken.delete(verificationToken.id);
    }

    return response.redirect("/dashboard?verified=true");
  }
}

export default new VerificationController();
