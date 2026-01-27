import type { NaraApp } from '@nara-web/core';

export function registerRoutes(app: NaraApp) {
  app.get('/', (req, res) => {
    res.inertia?.('landing', {
      title: 'Welcome to NARA'
    });
  });

  app.get('/dashboard', (req, res) => {
    res.inertia?.('dashboard');
  });

  app.get('/login', (req, res) => {
    res.inertia?.('auth/login');
  });

  app.get('/register', (req, res) => {
    res.inertia?.('auth/register');
  });

  app.get('/users', (req, res) => {
    res.inertia?.('users');
  });

  app.get('/profile', (req, res) => {
    res.inertia?.('profile');
  });
}
