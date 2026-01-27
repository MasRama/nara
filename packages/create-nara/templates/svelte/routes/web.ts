import type { NaraApp } from '@nara-web/core';
import { webAuthMiddleware, guestMiddleware } from '../app/middlewares/auth.js';

export function registerRoutes(app: NaraApp) {
  // Public routes
  app.get('/', (req, res) => {
    res.inertia?.('landing', {
      title: 'Welcome to NARA'
    });
  });

  // Guest only routes (redirect to dashboard if logged in)
  app.get('/login', guestMiddleware as any, (req, res) => {
    res.inertia?.('auth/login');
  });

  app.get('/register', guestMiddleware as any, (req, res) => {
    res.inertia?.('auth/register');
  });

  app.get('/forgot-password', guestMiddleware as any, (req, res) => {
    res.inertia?.('auth/forgot-password');
  });

  // Protected routes (redirect to login if not authenticated)
  app.get('/dashboard', webAuthMiddleware as any, (req, res) => {
    res.inertia?.('dashboard');
  });

  app.get('/users', webAuthMiddleware as any, (req, res) => {
    res.inertia?.('users');
  });

  app.get('/profile', webAuthMiddleware as any, (req, res) => {
    res.inertia?.('profile');
  });
}
