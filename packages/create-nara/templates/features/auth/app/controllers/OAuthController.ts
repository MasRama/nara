/**
 * OAuthController
 *
 * Handles OAuth authentication flows:
 * - Google OAuth redirect
 * - Google OAuth callback
 */
import { BaseController } from '@nara-web/core';
import type { NaraRequest, NaraResponse } from '@nara-web/core';
import { User } from '@models';
import { redirectParamsURL } from '@services/GoogleAuth';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const JWT_EXPIRES_SECONDS = 7 * 24 * 60 * 60; // 7 days in seconds

// Cookie options for auth token
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
};

interface GoogleTokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
  scope: string;
  refresh_token?: string;
}

interface GoogleUserInfo {
  id: string;
  email: string;
  verified_email: boolean;
  name: string;
  given_name?: string;
  family_name?: string;
  picture?: string;
}

export class OAuthController extends BaseController {
  /**
   * Redirect to Google OAuth
   */
  async googleRedirect(req: NaraRequest, res: NaraResponse) {
    const params = redirectParamsURL();
    const googleLoginUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
    return res.redirect(googleLoginUrl);
  }

  /**
   * Handle Google OAuth callback
   */
  async googleCallback(req: NaraRequest, res: NaraResponse) {
    const { code } = req.query;

    if (!code) {
      res.cookie('error', 'Authorization code not provided', 5000);
      return res.redirect('/login');
    }

    try {
      // Exchange authorization code for access token
      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: process.env.GOOGLE_CLIENT_ID || '',
          client_secret: process.env.GOOGLE_CLIENT_SECRET || '',
          redirect_uri: process.env.GOOGLE_REDIRECT_URI || '',
          grant_type: 'authorization_code',
          code: code as string,
        }),
      });

      if (!tokenResponse.ok) {
        res.cookie('error', 'Failed to exchange authorization code', 5000);
        return res.redirect('/login');
      }

      const tokenData: GoogleTokenResponse = await tokenResponse.json();

      // Get user info from Google
      const userResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`,
        },
      });

      if (!userResponse.ok) {
        res.cookie('error', 'Failed to get user info from Google', 5000);
        return res.redirect('/login');
      }

      const userData: GoogleUserInfo = await userResponse.json();
      const email = userData.email.toLowerCase();
      const name = userData.name;

      // Check if user exists
      let user = await User.findByEmail(email);

      if (!user) {
        // Create new user
        const userId = randomUUID();
        const hashedPassword = await bcrypt.hash(email + Date.now(), 10);

        await User.create({
          id: userId,
          email,
          password: hashedPassword,
          name,
          role: 'user',
          email_verified_at: userData.verified_email ? new Date().toISOString() : null,
        });

        user = await User.findById(userId);
      }

      if (!user) {
        res.cookie('error', 'Failed to create or find user', 5000);
        return res.redirect('/login');
      }

      // Generate JWT token
      const token = jwt.sign(
        { userId: user.id, email: user.email, name: user.name },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_SECONDS }
      );

      // Set auth cookie
      res.cookie('auth_token', token, JWT_EXPIRES_SECONDS * 1000, COOKIE_OPTIONS);

      // Redirect to dashboard
      return res.redirect('/dashboard');
    } catch (error) {
      console.error('Google OAuth error:', error);
      res.cookie('error', 'Authentication failed', 5000);
      return res.redirect('/login');
    }
  }
}
