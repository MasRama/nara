// @vitest-environment node
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import Database from 'better-sqlite3';
import { afterEach, describe, expect, it } from 'vitest';

const temporaryRoots: string[] = [];

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe('admin bootstrap', () => {
  it('awaits password hashing and persists a usable admin credential', () => {
    const root = mkdtempSync(path.join(tmpdir(), 'nara-admin-bootstrap-'));
    temporaryRoots.push(root);
    const databaseFile = path.join(root, 'bootstrap.sqlite3');
    const email = 'bootstrap-admin@example.com';
    const password = 'correct horse battery staple';

    const result = spawnSync(
      process.execPath,
      ['-r', 'ts-node/register', '-r', 'tsconfig-paths/register', 'scripts/bootstrap-admin.ts'],
      {
        cwd: process.cwd(),
        encoding: 'utf8',
        env: {
          ...process.env,
          NODE_ENV: 'test',
          DB_FILE: databaseFile,
          NARA_ADMIN_EMAIL: email,
          NARA_ADMIN_PASSWORD: password,
        },
      },
    );

    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain(`Admin bootstrap complete for ${email}`);

    const database = new Database(databaseFile);
    try {
      const user = database
        .prepare('SELECT id, password, must_change_password FROM users WHERE email = ?')
        .get(email) as { id: string; password: string; must_change_password: number } | undefined;
      expect(user?.password).toMatch(/^[a-f0-9]{32}:[a-f0-9]{128}$/);
      expect(user?.must_change_password).toBe(0);
      expect(
        database
          .prepare(
            `SELECT r.slug
             FROM roles r
             JOIN user_roles ur ON ur.role_id = r.id
             WHERE ur.user_id = ?`,
          )
          .get(user?.id),
      ).toEqual({ slug: 'admin' });
    } finally {
      database.close();
    }
  }, 20_000);

  it('creates a convenient default temporary admin through setup and stays idempotent', () => {
    const root = mkdtempSync(path.join(tmpdir(), 'nara-default-admin-'));
    temporaryRoots.push(root);
    const databaseFile = path.join(root, 'setup.sqlite3');
    const env = { ...process.env, NODE_ENV: 'test', DB_FILE: databaseFile };
    delete env.NARA_ADMIN_NAME;
    delete env.NARA_ADMIN_EMAIL;
    delete env.NARA_ADMIN_PASSWORD;

    const first = spawnSync(
      process.execPath,
      ['-r', 'ts-node/register', '-r', 'tsconfig-paths/register', 'scripts/setup.ts'],
      { cwd: process.cwd(), encoding: 'utf8', env },
    );
    expect(first.status, first.stderr).toBe(0);
    expect(first.stdout).toContain('Nara setup complete.');
    expect(first.stdout).toContain('admin@nara.local');
    expect(first.stdout).toContain('admin12345');
    expect(first.stdout).toContain('Change the default password after signing in.');

    const database = new Database(databaseFile);
    let originalHash = '';
    try {
      const user = database
        .prepare('SELECT id, password, must_change_password FROM users WHERE email = ?')
        .get('admin@nara.local') as { id: string; password: string; must_change_password: number } | undefined;
      expect(user?.password).toMatch(/^[a-f0-9]{32}:[a-f0-9]{128}$/);
      expect(user?.must_change_password).toBe(1);
      originalHash = user?.password ?? '';
      expect(
        database
          .prepare(
            `SELECT r.slug
             FROM roles r
             JOIN user_roles ur ON ur.role_id = r.id
             WHERE ur.user_id = ?`,
          )
          .get(user?.id),
      ).toEqual({ slug: 'admin' });
    } finally {
      database.close();
    }

    const second = spawnSync(
      process.execPath,
      ['-r', 'ts-node/register', '-r', 'tsconfig-paths/register', 'scripts/setup.ts'],
      { cwd: process.cwd(), encoding: 'utf8', env },
    );
    expect(second.status, second.stderr).toBe(0);
    expect(second.stdout).toContain('Admin bootstrap skipped; admin already exists: admin@nara.local.');

    const reopened = new Database(databaseFile);
    try {
      expect(reopened.prepare('SELECT password FROM users WHERE email = ?').get('admin@nara.local')).toEqual({
        password: originalHash,
      });
      expect(reopened.prepare('SELECT COUNT(*) AS count FROM users').get()).toEqual({ count: 1 });
    } finally {
      reopened.close();
    }
  }, 30_000);
});
