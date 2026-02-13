import type { NaraRequest, NaraResponse } from '@nara-web/core';
import { Session } from '../models/Session.js';

const SESSION_COOKIE_NAME = 'auth_id';

/**
 * Auth middleware for API routes
 * Returns 401 JSON if not authenticated
 */
export function authMiddleware(req: NaraRequest, res: NaraResponse, next: () => void) {
  if (!req.user) {
    res.status(401).json({ success: false, message: 'Unauthorized' });
    return;
  }
  next();
}

/**
 * Auth middleware for web/Inertia routes (session-based)
 * Redirects to login if not authenticated
 */
export async function webAuthMiddleware(req: NaraRequest, res: NaraResponse, next: () => void) {
  const sessionId = req.cookies?.[SESSION_COOKIE_NAME];
  const isApiRoute = req.path.startsWith('/api/');

  if (!sessionId) {
    if (isApiRoute) {
      res.status(401).json({ success: false, message: 'Unauthorized. Please log in.' });
    } else if (req.headers['x-inertia']) {
      res.setHeader('X-Inertia-Location', '/login').redirect('/login');
    } else {
      res.redirect('/login');
    }
    return;
  }

  try {
    // Get user from session using optimized JOIN query
    const user = await Session.getUserBySessionId(sessionId);

    if (!user) {
      // Session not found or invalid, clear cookie
      res.cookie(SESSION_COOKIE_NAME, '', 0);
      if (isApiRoute) {
        res.status(401).json({ success: false, message: 'Session expired. Please log in again.' });
    } else if (req.headers['x-inertia']) {
      res.setHeader('X-Inertia-Location', '/login').redirect('/login');
      } else {
        res.redirect('/login');
      }
      return;
    }

    // Attach user to request
    (req as any).user = user;
    next();
  } catch (error) {
    // Clear invalid session
    res.cookie(SESSION_COOKIE_NAME, '', 0);
    if (isApiRoute) {
      res.status(401).json({ success: false, message: 'Session error. Please log in again.' });
    } else if (req.headers['x-inertia']) {
      res.setHeader('X-Inertia-Location', '/login').redirect('/login');
    } else {
      res.redirect('/login');
    }
  }
}

/**
 * Guest middleware - only allow unauthenticated users
 * Redirects to dashboard if already logged in
 */
export async function guestMiddleware(req: NaraRequest, res: NaraResponse, next: () => void) {
  const sessionId = req.cookies?.[SESSION_COOKIE_NAME];

  if (sessionId) {
    try {
      const user = await Session.getUserBySessionId(sessionId);
      if (user) {
        // User is authenticated, redirect to dashboard
        if (req.headers['x-inertia']) {
          res.setHeader('X-Inertia-Location', '/dashboard').redirect('/dashboard');
        } else {
          res.redirect('/dashboard');
        }
        return;
      }
    } catch {
      // Invalid session, clear it and continue
      res.cookie(SESSION_COOKIE_NAME, '', 0);
    }
  }

  next();
}
