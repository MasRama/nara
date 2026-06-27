import type { NaraRequest, NaraResponse } from '@core';
import { hashPassword, processLogin } from '@services/Authenticate';
import { findUserByEmail, createUser } from '@queries';
import axios from 'axios';
import Logger from '@services/Logger';
import { randomBytes, randomUUID, timingSafeEqual } from 'crypto';
import { AUTH } from '@config';

const OAUTH_STATE_COOKIE = 'oauth_state';
const OAUTH_STATE_EXPIRY_MS = 10 * 60 * 1000;

const cookieOpts = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
});

const isValidState = (expected: string | undefined, received: unknown): boolean => {
  if (!expected || typeof received !== 'string') return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(received);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
};

const buildGoogleAuthURL = (state: string): string => {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID || '',
    redirect_uri: process.env.GOOGLE_REDIRECT_URI || '',
    scope: [
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile',
    ].join(' '),
    response_type: 'code',
    access_type: 'offline',
    prompt: 'consent',
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
};

export const googleRedirect = (_req: NaraRequest, res: NaraResponse) => {
  const state = randomBytes(32).toString('hex');
  res.cookie(OAUTH_STATE_COOKIE, state, { maxAge: OAUTH_STATE_EXPIRY_MS, ...cookieOpts() });
  return res.redirect(buildGoogleAuthURL(state));
};

export const googleCallback = async (req: NaraRequest, res: NaraResponse) => {
  const { code, state } = req.query;
  const expected = req.cookies[OAUTH_STATE_COOKIE];

  res.clearCookie(OAUTH_STATE_COOKIE, cookieOpts());

  if (!isValidState(expected, state)) {
    Logger.logSecurity('OAuth state invalid', { ip: req.ip });
    return res.cookie('error', 'Sesi login Google tidak valid', { maxAge: AUTH.ERROR_COOKIE_EXPIRY_MS }).redirect('/login');
  }

  if (typeof code !== 'string' || !code) {
    return res.cookie('error', 'Kode OAuth tidak valid', { maxAge: AUTH.ERROR_COOKIE_EXPIRY_MS }).redirect('/login');
  }

  const { data: tokenData } = await axios.post('https://oauth2.googleapis.com/token', {
    client_id: process.env.GOOGLE_CLIENT_ID,
    client_secret: process.env.GOOGLE_CLIENT_SECRET,
    redirect_uri: process.env.GOOGLE_REDIRECT_URI,
    grant_type: 'authorization_code',
    code,
  });

  const { data: userInfo } = await axios.get('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });

  const email = userInfo.email.toLowerCase();
  const existing = findUserByEmail(email);

  if (existing) {
    return processLogin(existing, req, res);
  }

  const user = createUser({
    id: randomUUID(),
    email,
    password: hashPassword(email),
    name: userInfo.name,
  });

  Logger.logAuth('google_registration_success', { userId: user.id, ip: req.ip });
  return processLogin(user, req, res);
};
