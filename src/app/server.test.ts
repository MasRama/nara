import { describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';
import { app, databaseReady } from './server';

describe('v3 application health', () => {
  it('composes the official health Feature', async () => {
    const response = await app.request('/health');
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ status: 'ok' });
  });

  it('reports database readiness', async () => {
    const response = await app.request('/ready');
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ status: 'ok' });
  });

  it('does not report readiness for a connected database missing the application schema', () => {
    const empty = new Database(':memory:');
    try {
      expect(empty.prepare('SELECT 1').get()).toEqual({ '1': 1 });
      expect(databaseReady(empty)).toBe(false);
    } finally {
      empty.close();
    }
  });
});
