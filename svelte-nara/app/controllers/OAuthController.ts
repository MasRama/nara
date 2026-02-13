/**
 * OAuthController
 * 
 * Handles OAuth authentication flows:
 * - Google OAuth redirect
 * - Google OAuth callback
 */
import Authenticate from "@services/Authenticate";
import { User } from "@models";
import { redirectParamsURL } from "@services/GoogleAuth";
import axios from "axios";
import Logger from "@services/Logger";
import type { NaraRequest, NaraResponse } from "@core";
import { BaseController } from "@core"; 
import { randomUUID } from "crypto";

class OAuthController extends BaseController {
  /**
   * Redirect to Google OAuth
   */
  public async googleRedirect(request: NaraRequest, response: NaraResponse) {
    const params = redirectParamsURL();
    const googleLoginUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
    return response.redirect(googleLoginUrl);
  }

  /**
   * Handle Google OAuth callback
   */
  public async googleCallback(request: NaraRequest, response: NaraResponse) {
    const { code } = request.query;

    const { data } = await axios({
      url: `https://oauth2.googleapis.com/token`,
      method: "post",
      data: {
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: process.env.GOOGLE_REDIRECT_URI,
        grant_type: "authorization_code",
        code,
      },
    });

    const result = await axios({
      url: "https://www.googleapis.com/oauth2/v2/userinfo",
      method: "get",
      headers: {
        Authorization: `Bearer ${data.access_token}`,
      },
    });

    let { email, name, verified_email } = result.data;

    email = email.toLowerCase();

    const existingUser = await User.findByEmail(email);

    if (existingUser) {
      return Authenticate.process(existingUser, request, response);
    } else {
      const user = await User.create({
        id: randomUUID(),
        email: email,
        password: await Authenticate.hash(email),
        name: name,
        is_verified: verified_email,
      });

      Logger.logAuth('google_registration_success', {
        userId: user.id,
        email: user.email,
        ip: request.ip
      });

      return Authenticate.process(user, request, response);
    }
  }
}

export default new OAuthController();
