import type { NaraRequest, NaraResponse } from '@nara-web/core';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

/**
 * Auth middleware for API routes (Bearer token)
 */
export function authMiddleware(req: NaraRequest, res: NaraResponse, next: () => void) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const token = authHeader.substring(7);

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: number; email: string };
    req.user = { id: decoded.userId, email: decoded.email, name: '' };
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
}

/**
 * Auth middleware for web/Inertia routes (cookie-based)
 * Redirects to login if not authenticated
 */
export function webAuthMiddleware(req: NaraRequest, res: NaraResponse, next: () => void) {
  // Check for auth token in cookie
  const token = req.cookies?.auth_token;

  if (!token) {
    // For Inertia requests, redirect to login
    if (req.headers['x-inertia']) {
      res.status(409).setHeader('X-Inertia-Location', '/login').send('');
    } else {
      res.redirect('/login');
    }
    return;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: number; email: string; name: string };
    req.user = { id: decoded.userId, email: decoded.email, name: decoded.name };
    next();
  } catch (error) {
    // Clear invalid token
    res.cookie('auth_token', '', { maxAge: 0 });
    if (req.headers['x-inertia']) {
      res.status(409).setHeader('X-Inertia-Location', '/login').send('');
    } else {
      res.redirect('/login');
    }
  }
}

/**
 * Guest middleware - only allow unauthenticated users
 * Redirects to dashboard if already logged in
 */
export function guestMiddleware(req: NaraRequest, res: NaraResponse, next: () => void) {
  const token = req.cookies?.auth_token;

  if (token) {
    try {
      jwt.verify(token, JWT_SECRET);
      // User is authenticated, redirect to dashboard
      if (req.headers['x-inertia']) {
        res.status(409).setHeader('X-Inertia-Location', '/dashboard').send('');
      } else {
        res.redirect('/dashboard');
      }
      return;
    } catch {
      // Invalid token, clear it and continue
      res.cookie('auth_token', '', { maxAge: 0 });
    }
  }

  next();
}
