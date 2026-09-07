// @vitest-environment node
import { readFileSync } from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';

describe('auth forward migrations', () => {
  it('backfills legacy null user names and enforces the runtime string invariant', () => {
    const database = new Database(':memory:');
    database.exec(readFileSync(path.resolve('src/features/auth/server/migrations/202609030001_create_users.sql'), 'utf8'));
    database
      .prepare('INSERT INTO users (id, name, email, password, avatar, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run('legacy-user', null, 'legacy@example.com', 'hash', null, 1, 1);

    database.exec(readFileSync(path.resolve('src/features/auth/server/migrations/202609030010_require_user_name.sql'), 'utf8'));
    expect(database.prepare('SELECT name FROM users WHERE id = ?').get('legacy-user')).toEqual({ name: 'legacy@example.com' });
    expect(() => database.prepare('UPDATE users SET name = NULL WHERE id = ?').run('legacy-user')).toThrow(/must not be null/);
    expect(() =>
      database
        .prepare('INSERT INTO users (id, name, email, password, avatar, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .run('new-user', null, 'new@example.com', 'hash', null, 1, 1),
    ).toThrow(/must not be null/);
    database.close();
  });
});
