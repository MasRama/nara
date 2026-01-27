import type { NaraApp } from '@nara-web/core';

export function registerRoutes(app: NaraApp) {
  app.get('/', (req, res) => {
    res.json({ message: 'Welcome to NARA API' });
  });

  app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
  });
}
