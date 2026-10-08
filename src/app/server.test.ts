import { describe, expect, it, vi } from 'vitest';
import Database from 'better-sqlite3';
import { app, databaseReady } from './server';
import { discoverMigrations, migrate } from '../shared/database';
import { Logger } from '../shared/logging';

describe('application health', () => {
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

  it('names the Feature and migration that keep the database unready, once per change', () => {
    const database = new Database(':memory:');
    try {
      migrate({ database });
      const latest = database
        .prepare('SELECT * FROM _nara_migrations ORDER BY id DESC LIMIT 1')
        .get() as { id: string; name: string } & Record<string, unknown>;
      const owner = discoverMigrations().find((migration) => migration.id === latest.id)!.feature;
      database.prepare('DELETE FROM _nara_migrations WHERE id = ?').run(latest.id);
      const warnings: unknown[][] = [];
      vi.spyOn(Logger, 'warn').mockImplementation(((...args: unknown[]) => {
        warnings.push(args);
      }) as typeof Logger.warn);

      expect(databaseReady(database)).toBe(false);
      expect(databaseReady(database)).toBe(false);

      expect(warnings).toEqual([
        ['Database not ready', { outstanding: [{ feature: owner, migration: latest.name }] }],
      ]);
      database
        .prepare('INSERT INTO _nara_migrations (id, name, checksum, applied_at, duration_ms) VALUES (@id, @name, @checksum, @applied_at, @duration_ms)')
        .run(latest);
      expect(databaseReady(database)).toBe(true);
      expect(warnings).toHaveLength(1);
    } finally {
      database.close();
      vi.restoreAllMocks();
    }
  });

  it('does not report readiness when an applied migration checksum no longer matches', () => {
    const database = new Database(':memory:');
    try {
      migrate({ database });
      database.prepare("UPDATE _nara_migrations SET checksum = 'tampered' WHERE id = (SELECT MIN(id) FROM _nara_migrations)").run();
      expect(databaseReady(database)).toBe(false);
    } finally {
      database.close();
    }
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
