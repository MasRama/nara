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
import { randomBytes, randomUUID, timingSafeEqual } from "crypto";
import { AUTH } from "@config";

const OAUTH_STATE_COOKIE = "oauth_state";
const OAUTH_STATE_EXPIRY_MS = 10 * 60 * 1000;

function getOAuthCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
  };
}

function isValidState(expected: string | undefined, received: unknown): boolean {
  if (!expected || typeof received !== "string") {
    return false;
  }

  const expectedBuffer = Buffer.from(expected);
  const receivedBuffer = Buffer.from(received);

  if (expectedBuffer.length !== receivedBuffer.length) {
    return false;
  }

  return timingSafeEqual(expectedBuffer, receivedBuffer);
}

class OAuthController extends BaseController {
  /**
   * Redirect to Google OAuth
   */
  public async googleRedirect(request: NaraRequest, response: NaraResponse) {
    const state = randomBytes(32).toString("hex");
    const params = new URLSearchParams(redirectParamsURL());
    params.set("state", state);
    const googleLoginUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
    response.cookie(OAUTH_STATE_COOKIE, state, OAUTH_STATE_EXPIRY_MS, getOAuthCookieOptions());
    return response.redirect(googleLoginUrl);
  }

  /**
   * Handle Google OAuth callback
   */
  public async googleCallback(request: NaraRequest, response: NaraResponse) {
    const { code, state } = request.query;
    const expectedState = request.cookies[OAUTH_STATE_COOKIE];

    response.cookie(OAUTH_STATE_COOKIE, "", 0, getOAuthCookieOptions());

    if (!isValidState(expectedState, state)) {
      Logger.logSecurity("Google OAuth callback rejected - invalid state", {
        ip: request.ip,
        hasExpectedState: !!expectedState,
        hasReceivedState: typeof state === "string",
      });

      return response
        .cookie("error", "Sesi login Google tidak valid", AUTH.ERROR_COOKIE_EXPIRY_MS)
        .redirect("/login");
    }

    if (typeof code !== "string" || !code) {
      return response
        .cookie("error", "Kode OAuth tidak valid", AUTH.ERROR_COOKIE_EXPIRY_MS)
        .redirect("/login");
    }

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
