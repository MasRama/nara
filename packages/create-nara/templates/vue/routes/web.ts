import type { NaraApp } from '@nara-web/core';

export function registerRoutes(app: NaraApp) {
  app.get('/', (req, res) => {
    return res.inertia('landing', {
        title: 'Welcome to NARA'
    });
  });

  app.get('/dashboard', (req, res) => {
    return res.inertia('dashboard');
  });

  app.get('/login', (req, res) => {
    return res.inertia('auth/login');
  });
}
