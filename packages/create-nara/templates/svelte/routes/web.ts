import type { NaraApp } from '@nara-web/core';
import { webAuthMiddleware, guestMiddleware } from '../app/middlewares/auth.js';
import fs from 'fs';
import path from 'path';

export function registerRoutes(app: NaraApp) {
  // Serve uploaded files
  app.get('/uploads/*', (req, res) => {
    const requestPath = req.path?.replace('/uploads/', '') || '';
    const filePath = path.join(process.cwd(), 'uploads', requestPath);

    if (fs.existsSync(filePath)) {
      const ext = path.extname(filePath).toLowerCase();
      const mimeTypes: Record<string, string> = {
        '.webp': 'image/webp',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.gif': 'image/gif',
      };
      res.setHeader('Content-Type', mimeTypes[ext] || 'application/octet-stream');
      res.setHeader('Cache-Control', 'public, max-age=31536000');
      res.send(fs.readFileSync(filePath));
    } else {
      res.status(404).send('Not found');
    }
  });

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
