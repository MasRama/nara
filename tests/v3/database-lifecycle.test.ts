import { execFile, spawn, type ChildProcess } from 'node:child_process';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import Database from 'better-sqlite3';
import { afterEach, describe, expect, it } from 'vitest';
import { discoverMigrations, migrate, migrateFresh, migrateStatus } from '../../src/shared/database/migrator';
import { discoverSeeds, seed } from '../../src/shared/database/seeder';

type TestDatabase = Database.Database;

const execFileAsync = promisify(execFile);
const temporaryDirectories: string[] = [];

function temporaryRoot(): string {
  const root = mkdtempSync(path.join(os.tmpdir(), 'nara-database-lifecycle-'));
  temporaryDirectories.push(root);
  return root;
}

function writeMigration(root: string, feature: string, filename: string, sql: string): string {
  const directory = path.join(root, 'src', 'features', feature, 'server', 'migrations');
  mkdirSync(directory, { recursive: true });
  const file = path.join(directory, filename);
  writeFileSync(file, sql);
  return file;
}

function writeSeed(root: string, feature: string, filename: string, source: string): string {
  const directory = path.join(root, 'src', 'features', feature, 'server', 'seeds');
  mkdirSync(directory, { recursive: true });
  const file = path.join(directory, filename);
  writeFileSync(file, source);
  return file;
}

function tableNames(database: TestDatabase): string[] {
  return (
    database
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
      .all() as Array<{ name: string }>
  ).map((row) => row.name);
}

function openMemoryDatabase(): TestDatabase {
  return new Database(':memory:');
}

async function freePort(): Promise<number> {
  const server = net.createServer();
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve());
  });
  const address = server.address();
  if (!address || typeof address === 'string') {
    server.close();
    throw new Error('Could not determine a free test port');
  }
  const port = address.port;
  await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  return port;
}

function startApplication(databaseFile: string, port: number): ChildProcess & { output: () => string } {
  const child = spawn(
    process.execPath,
    [
      '-r',
      path.resolve('node_modules/ts-node/register'),
      '-r',
      path.resolve('node_modules/tsconfig-paths/register'),
      '-e',
      "const { startServer } = require('./src/app/server'); const server = startServer(Number(process.env.NARA_TEST_PORT)); process.once('SIGTERM', () => server.close());",
    ],
    {
      cwd: process.cwd(),
      env: {
        ...process.env,
        NODE_ENV: 'development',
        APP_URL: `http://127.0.0.1:${port}`,
        DB_FILE: databaseFile,
        NARA_TEST_PORT: String(port),
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );

  let output = '';
  child.stdout?.on('data', (chunk: Buffer) => {
    output += chunk.toString();
  });
  child.stderr?.on('data', (chunk: Buffer) => {
    output += chunk.toString();
  });
  return Object.assign(child, { output: () => output });
}

interface MigrationProcessResult {
  code: number | null;
  output: string;
}

interface MigrationProcess {
  child: ChildProcess;
  ready: Promise<void>;
  result: Promise<MigrationProcessResult>;
}

function startMigrationProcess(databaseFile: string, holdLock: boolean): MigrationProcess {
  // The lock holder releases only after it observes the contender actually
  // attempting (filesystem sentinel), never after a fixed delay: contender
  // boot time under parallel-suite load is unbounded, so a fixed hold
  // window races with slow boots and flakes the serialization assertion.
  const script = holdLock
    ? `
const fs = require('node:fs');
const { getDatabase, migrate } = require('./src/shared/database');
const database = getDatabase();
database.exec('BEGIN IMMEDIATE');
process.stdout.write('LOCK_ACQUIRED\\n');
const sentinel = process.env.NARA_MIGRATION_SENTINEL;
const deadline = Date.now() + 20000;
while (!fs.existsSync(sentinel)) {
  if (Date.now() > deadline) {
    process.stderr.write('SENTINEL_TIMEOUT\\n');
    process.exit(1);
  }
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 50);
}
Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 2000);
database.exec('COMMIT');
const startedAt = Date.now();
const result = migrate();
process.stdout.write('MIGRATION_RESULT:' + JSON.stringify(result) + '\\n');
process.stdout.write('MIGRATION_DURATION_MS:' + (Date.now() - startedAt) + '\\n');
`
    : `
const fs = require('node:fs');
const { migrate } = require('./src/shared/database');
fs.writeFileSync(process.env.NARA_MIGRATION_SENTINEL, 'attempting');
process.stdout.write('MIGRATION_ATTEMPTING\\n');
const startedAt = Date.now();
const result = migrate();
process.stdout.write('MIGRATION_RESULT:' + JSON.stringify(result) + '\\n');
process.stdout.write('MIGRATION_DURATION_MS:' + (Date.now() - startedAt) + '\\n');
`;
  const child = spawn(
    process.execPath,
    [
      '-r',
      path.resolve('node_modules/ts-node/register'),
      '-r',
      path.resolve('node_modules/tsconfig-paths/register'),
      '-e',
      script,
    ],
    {
      cwd: process.cwd(),
      env: {
        ...process.env,
        NODE_ENV: 'development',
        APP_URL: 'http://127.0.0.1:5555',
        DB_FILE: databaseFile,
        NARA_MIGRATION_SENTINEL: `${databaseFile}.attempting`,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );

  let output = '';
  const readyResolvers = Promise.withResolvers<void>();
  let readySignaled = !holdLock;
  if (!holdLock) readyResolvers.resolve();

  child.stdout?.on('data', (chunk: Buffer) => {
    output += chunk.toString();
    if (holdLock && !readySignaled && output.includes('LOCK_ACQUIRED')) {
      readySignaled = true;
      readyResolvers.resolve();
    }
  });
  child.stderr?.on('data', (chunk: Buffer) => {
    output += chunk.toString();
  });

  const result = new Promise<MigrationProcessResult>((resolve) => {
    child.once('close', (code) => {
      if (holdLock && !readySignaled) {
        readySignaled = true;
        readyResolvers.reject(new Error(`Migration process exited before acquiring its lock:\\n${output}`));
      }
      resolve({ code, output });
    });
  });

  return { child, ready: readyResolvers.promise, result };
}

async function waitForReady(child: ChildProcess & { output: () => string }, port: number): Promise<void> {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`Application exited before readiness:\n${child.output()}`);
    }
    try {
      const response = await fetch(`http://127.0.0.1:${port}/ready`);
      if (response.status === 200) return;
    } catch {
      // The listener may not have bound yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Application did not become ready:\n${child.output()}`);
}

async function waitForExit(child: ChildProcess, timeout = 10_000): Promise<number | null> {
  if (child.exitCode !== null) return child.exitCode;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Child process did not exit in time')), timeout);
    child.once('exit', (code) => {
      clearTimeout(timer);
      resolve(code);
    });
  });
}

async function stopApplication(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null) return;
  child.kill('SIGTERM');
  try {
    await waitForExit(child);
  } catch {
    child.kill('SIGKILL');
    await waitForExit(child);
  }
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe('canonical SQLite migration lifecycle', () => {
  it('migrates an empty database and makes the second run a no-op', () => {
    const database = openMemoryDatabase();
    try {
      const first = migrate({ database, root: process.cwd() });
      expect(first.applied).toHaveLength(8);
      expect(first.skipped).toEqual([]);
      expect(tableNames(database)).toEqual([
        '_nara_migrations',
        'assets',
        'permissions',
        'role_permissions',
        'roles',
        'sessions',
        'user_roles',
        'users',
      ]);
      expect(
        database.prepare('SELECT COUNT(*) AS count FROM _nara_migrations').get(),
      ).toEqual({ count: 8 });
      expect(
        (database.prepare('SELECT checksum FROM _nara_migrations').all() as Array<{ checksum: string }>).every(
          (row) => /^[a-f0-9]{64}$/.test(row.checksum),
        ),
      ).toBe(true);

      const second = migrate({ database, root: process.cwd() });
      expect(second).toEqual({ applied: [], skipped: first.applied });
    } finally {
      database.close();
    }
  });

  it('rolls back a failing migration and leaves no ledger row', () => {
    const root = temporaryRoot();
    writeMigration(
      root,
      'broken',
      '202609030101_create_partial.sql',
      'CREATE TABLE partial (id TEXT PRIMARY KEY);\nCREATE TABL broken (id TEXT PRIMARY KEY);\n',
    );
    const database = openMemoryDatabase();
    try {
      expect(() => migrate({ database, root })).toThrow(/failed and was rolled back/);
      expect(tableNames(database)).toEqual(['_nara_migrations']);
      expect(database.prepare('SELECT COUNT(*) AS count FROM _nara_migrations').get()).toEqual({ count: 0 });
    } finally {
      database.close();
    }
  });

  it('rejects edits to an already-applied migration checksum', () => {
    const root = temporaryRoot();
    const migration = writeMigration(root, 'checksum', '202609030102_create_values.sql', 'CREATE TABLE values_table (id TEXT PRIMARY KEY);\n');
    const database = openMemoryDatabase();
    try {
      migrate({ database, root });
      writeFileSync(migration, 'CREATE TABLE values_table (id TEXT PRIMARY KEY, value TEXT);\n');
      expect(() => migrateStatus({ database, root })).toThrow(/Applied migration.*immutable/);
      expect(() => migrate({ database, root })).toThrow(/Applied migration.*immutable/);
    } finally {
      database.close();
    }
  });

  it('orders migrations by global identifier across Feature locations', () => {
    const root = temporaryRoot();
    writeMigration(root, 'zeta', '202609030104_append_zeta.sql', "INSERT INTO migration_order (name) VALUES ('zeta');\n");
    writeMigration(root, 'alpha', '202609030103_create_order.sql', 'CREATE TABLE migration_order (name TEXT NOT NULL);\n');
    writeMigration(root, 'alpha', '202609030105_append_alpha.sql', "INSERT INTO migration_order (name) VALUES ('alpha');\n");
    const database = openMemoryDatabase();
    try {
      expect(discoverMigrations({ root }).map((migration) => migration.name)).toEqual([
        '202609030103_create_order.sql',
        '202609030104_append_zeta.sql',
        '202609030105_append_alpha.sql',
      ]);
      migrate({ database, root });
      expect(database.prepare('SELECT name FROM migration_order').all()).toEqual([
        { name: 'zeta' },
        { name: 'alpha' },
      ]);
    } finally {
      database.close();
    }
  });

  it('fails clearly when Feature migrations reuse an identifier', () => {
    const root = temporaryRoot();
    writeMigration(root, 'alpha', '202609030106_create_alpha.sql', 'CREATE TABLE alpha (id TEXT PRIMARY KEY);\n');
    writeMigration(root, 'beta', '202609030106_create_beta.sql', 'CREATE TABLE beta (id TEXT PRIMARY KEY);\n');
    const database = openMemoryDatabase();
    try {
      expect(() => migrate({ database, root })).toThrow(/Duplicate migration ID "202609030106"/);
    } finally {
      database.close();
    }
  });

  it('fresh rebuilds through migrations, seeds reference data, and refuses production', () => {
    const root = temporaryRoot();
    writeMigration(root, 'catalog', '202609030107_create_reference.sql', 'CREATE TABLE reference_values (key TEXT PRIMARY KEY, value TEXT NOT NULL);\n');
    writeSeed(
      root,
      'catalog',
      '202609030001_reference.js',
      "module.exports.run = (database) => database.prepare(\"INSERT INTO reference_values (key, value) VALUES ('color', 'blue') ON CONFLICT(key) DO NOTHING\").run();\n",
    );
    const database = openMemoryDatabase();
    try {
      migrate({ database, root });
      seed({ database, root });
      database.prepare("INSERT INTO reference_values (key, value) VALUES ('temporary', 'remove')").run();

      migrateFresh({ database, root });
      seed({ database, root });
      expect(database.prepare('SELECT key, value FROM reference_values ORDER BY key').all()).toEqual([
        { key: 'color', value: 'blue' },
      ]);

      const previousNodeEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      try {
        expect(() => migrateFresh({ database, root })).toThrow(/Refusing migrate:fresh in production/);
      } finally {
        process.env.NODE_ENV = previousNodeEnv;
      }
    } finally {
      database.close();
    }
  });

  it('runs reference seeds repeatedly without duplicate permissions or roles', () => {
    const database = openMemoryDatabase();
    try {
      migrate({ database, root: process.cwd() });
      expect(discoverSeeds({ root: process.cwd() }).map((seedFile) => seedFile.name)).toEqual([
        '202609030001_permissions.ts',
        '202609030002_roles.ts',
        '202609030003_role_permissions.ts',
      ]);
      seed({ database, root: process.cwd() });
      seed({ database, root: process.cwd() });
      expect(database.prepare('SELECT COUNT(*) AS count FROM permissions').get()).toEqual({ count: 10 });
      expect(database.prepare('SELECT COUNT(*) AS count FROM roles').get()).toEqual({ count: 2 });
      expect(database.prepare('SELECT COUNT(*) AS count FROM role_permissions').get()).toEqual({ count: 12 });
      expect(database.prepare('SELECT COUNT(*) AS count FROM users').get()).toEqual({ count: 0 });
    } finally {
      database.close();
    }
  });

  it('runs pending migrations before HTTP listen and aborts on migration failure', { timeout: 60_000 }, async () => {
    const root = temporaryRoot();
    const databaseFile = path.join(root, 'database.sqlite3');
    const port = await freePort();
    const child = startApplication(databaseFile, port);
    try {
      await waitForReady(child, port);
      const database = new Database(databaseFile);
      try {
        expect(database.prepare('SELECT COUNT(*) AS count FROM _nara_migrations').get()).toEqual({ count: 8 });
      } finally {
        database.close();
      }
    } finally {
      await stopApplication(child);
    }

    const failingDatabaseFile = path.join(root, 'failing.sqlite3');
    const failingDatabase = new Database(failingDatabaseFile);
    failingDatabase.exec('CREATE TABLE users (id TEXT PRIMARY KEY);');
    failingDatabase.close();
    const failingChild = startApplication(failingDatabaseFile, await freePort());
    // Full-app ts-node boot under parallel-suite load can exceed the
    // default exit wait; the property under test is the abort itself
    // (non-zero exit naming the cause), not boot speed.
    const exitCode = await waitForExit(failingChild, 25_000);
    expect(exitCode).not.toBe(0);
    expect((failingChild as ChildProcess & { output?: () => string }).output?.()).toMatch(/not equivalent|failed/);
  });
  it('serializes two migration processes against one persistent database', { timeout: 60_000 }, async () => {
    const root = temporaryRoot();
    const databaseFile = path.join(root, 'concurrent.sqlite3');
    const first = startMigrationProcess(databaseFile, true);
    let second: MigrationProcess | undefined;

    try {
      await first.ready;
      second = startMigrationProcess(databaseFile, false);
      const [firstResult, secondResult] = await Promise.all([first.result, second.result]);

      expect(firstResult.code).toBe(0);
      expect(secondResult.code).toBe(0);
      expect(secondResult.output).toContain('MIGRATION_ATTEMPTING');
      const waitedMilliseconds = Number(secondResult.output.match(/MIGRATION_DURATION_MS:(\d+)/)?.[1]);
      expect(waitedMilliseconds).toBeGreaterThanOrEqual(1_000);

      const migrationResults = [firstResult, secondResult].map(({ output }) => {
        const payload = output.match(/MIGRATION_RESULT:(\{.*\})/);
        expect(payload).not.toBeNull();
        return JSON.parse(payload![1]) as { applied: string[]; skipped: string[] };
      });
      expect(migrationResults.some((result) => result.applied.length === 8)).toBe(true);
      expect(migrationResults.some((result) => result.skipped.length === 8)).toBe(true);

      const database = new Database(databaseFile);
      try {
        expect(database.prepare('SELECT COUNT(*) AS count FROM _nara_migrations').get()).toEqual({ count: 8 });
        expect(
          database
            .prepare(
              'SELECT id FROM _nara_migrations GROUP BY id HAVING COUNT(*) > 1',
            )
            .all(),
        ).toEqual([]);
        expect(tableNames(database)).toEqual([
          '_nara_migrations',
          'assets',
          'permissions',
          'role_permissions',
          'roles',
          'sessions',
          'user_roles',
          'users',
        ]);
      } finally {
        database.close();
      }
    } finally {
      for (const process of [first, second]) {
        if (process && process.child.exitCode === null) process.child.kill('SIGKILL');
      }
    }
  });

  it('creates an openable online backup with expected data', async () => {
    const root = temporaryRoot();
    const databaseFile = path.join(root, 'source.sqlite3');
    const database = new Database(databaseFile);
    database.exec('CREATE TABLE values_table (id TEXT PRIMARY KEY, value TEXT NOT NULL);');
    database.prepare('INSERT INTO values_table (id, value) VALUES (?, ?)').run('one', 'kept');
    database.close();

    const command = path.resolve('scripts/database.ts');
    const { stdout } = await execFileAsync(
      process.execPath,
      ['-r', path.resolve('node_modules/ts-node/register'), '-r', path.resolve('node_modules/tsconfig-paths/register'), command, 'db:backup'],
      {
        cwd: root,
        env: {
          ...process.env,
          NODE_ENV: 'development',
          APP_URL: 'http://127.0.0.1:5555',
          DB_FILE: databaseFile,
          TS_NODE_PROJECT: path.resolve('tsconfig.json'),
        },
      },
    );
    const backupPath = stdout.match(/Database backup created: (.+)\n/)?.[1];
    expect(backupPath).toBeDefined();
    const backup = new Database(backupPath!);
    try {
      expect(backup.prepare('SELECT id, value FROM values_table').all()).toEqual([{ id: 'one', value: 'kept' }]);
    } finally {
      backup.close();
    }
  });

  it('passes the deterministic integrity command on a healthy database', async () => {
    const root = temporaryRoot();
    const databaseFile = path.join(root, 'healthy.sqlite3');
    const database = new Database(databaseFile);
    database.exec('CREATE TABLE values_table (id TEXT PRIMARY KEY);');
    database.close();

    const command = path.resolve('scripts/database.ts');
    const { stdout } = await execFileAsync(
      process.execPath,
      ['-r', path.resolve('node_modules/ts-node/register'), '-r', path.resolve('node_modules/tsconfig-paths/register'), command, 'db:check'],
      {
        cwd: root,
        env: {
          ...process.env,
          NODE_ENV: 'development',
          APP_URL: 'http://127.0.0.1:5555',
          DB_FILE: databaseFile,
          TS_NODE_PROJECT: path.resolve('tsconfig.json'),
        },
      },
    );
    expect(stdout).toContain('quick_check, foreign_key_check');
  });

  it('refuses backup and integrity checks when the persistent database is missing', { timeout: 20_000 }, async () => {
    const root = temporaryRoot();
    const missingDatabase = path.join(root, 'missing.sqlite3');
    const command = path.resolve('scripts/database.ts');
    const environment = {
      ...process.env,
      NODE_ENV: 'development',
      APP_URL: 'http://127.0.0.1:5555',
      DB_FILE: missingDatabase,
      TS_NODE_PROJECT: path.resolve('tsconfig.json'),
    };

    for (const operation of ['db:backup', 'db:check']) {
      let failure: { code?: number; stderr?: string } | undefined;
      try {
        await execFileAsync(
          process.execPath,
          [
            '-r',
            path.resolve('node_modules/ts-node/register'),
            '-r',
            path.resolve('node_modules/tsconfig-paths/register'),
            command,
            operation,
          ],
          { cwd: root, env: environment },
        );
      } catch (error) {
        failure = error as { code?: number; stderr?: string };
      }

      expect(failure).toBeDefined();
      expect(failure?.code).not.toBe(0);
      expect(failure?.stderr).toMatch(/does not exist/);
    }

    expect(existsSync(missingDatabase)).toBe(false);
    expect(existsSync(path.join(root, 'database'))).toBe(false);
  });

  it('bootstraps the previous v3 schema only when its full shape matches', () => {
    const database = openMemoryDatabase();
    try {
      database.exec(readFileSync(path.resolve('src/features/auth/server/migrations/202609030001_create_users.sql'), 'utf8'));
      database.exec(readFileSync(path.resolve('src/features/auth/server/migrations/202609030002_create_sessions.sql'), 'utf8'));
      database.exec(readFileSync(path.resolve('src/features/auth/server/migrations/202609030003_create_roles.sql'), 'utf8'));
      database.exec(readFileSync(path.resolve('src/features/auth/server/migrations/202609030004_create_permissions.sql'), 'utf8'));
      database.exec(readFileSync(path.resolve('src/features/auth/server/migrations/202609030005_create_role_permissions.sql'), 'utf8'));
      database.exec(readFileSync(path.resolve('src/features/auth/server/migrations/202609030006_create_user_roles.sql'), 'utf8'));
      database.exec(readFileSync(path.resolve('src/features/users/server/migrations/202609030007_create_assets.sql'), 'utf8'));
      database.prepare('INSERT INTO users (id, email, password, created_at, updated_at) VALUES (?, ?, ?, ?, ?)').run(
        'legacy-user',
        'legacy@example.com',
        'hash',
        1,
        1,
      );

      const result = migrate({ database, root: process.cwd() });
      expect(result.applied).toEqual(['202609030008_assets_owner_reference.sql']);
      expect(result.skipped).toHaveLength(7);
      expect(database.prepare('SELECT email FROM users').get()).toEqual({ email: 'legacy@example.com' });
      expect(database.prepare('SELECT COUNT(*) AS count FROM _nara_migrations').get()).toEqual({ count: 8 });
      expect(database.pragma('foreign_key_list(assets)')).toEqual([]);
    } finally {
      database.close();
    }
  });
  it('does not treat a STRICT schema as the previous v3 baseline', () => {
    const database = openMemoryDatabase();
    try {
      const usersMigration = readFileSync(
        path.resolve('src/features/auth/server/migrations/202609030001_create_users.sql'),
        'utf8',
      ).replace(/\);\s*$/, ') STRICT;\n');
      database.exec(usersMigration);
      database.exec(readFileSync(path.resolve('src/features/auth/server/migrations/202609030002_create_sessions.sql'), 'utf8'));
      database.exec(readFileSync(path.resolve('src/features/auth/server/migrations/202609030003_create_roles.sql'), 'utf8'));
      database.exec(readFileSync(path.resolve('src/features/auth/server/migrations/202609030004_create_permissions.sql'), 'utf8'));
      database.exec(readFileSync(path.resolve('src/features/auth/server/migrations/202609030005_create_role_permissions.sql'), 'utf8'));
      database.exec(readFileSync(path.resolve('src/features/auth/server/migrations/202609030006_create_user_roles.sql'), 'utf8'));
      database.exec(readFileSync(path.resolve('src/features/users/server/migrations/202609030007_create_assets.sql'), 'utf8'));

      expect(() => migrate({ database, root: process.cwd() })).toThrow(/not equivalent/);
      expect(database.prepare('SELECT COUNT(*) AS count FROM _nara_migrations').get()).toEqual({ count: 0 });
    } finally {
      database.close();
    }
  });
  it('accepts the users migration at its new auth location without rerunning it', () => {
    const migrationSql = (feature: string, name: string): string =>
      readFileSync(path.resolve(`src/features/${feature}/server/migrations/${name}`), 'utf8');
    const baseline: Array<[string, string]> = [
      ['auth', '202609030001_create_users.sql'],
      ['auth', '202609030002_create_sessions.sql'],
      ['auth', '202609030003_create_roles.sql'],
      ['auth', '202609030004_create_permissions.sql'],
      ['auth', '202609030005_create_role_permissions.sql'],
      ['auth', '202609030006_create_user_roles.sql'],
      ['users', '202609030007_create_assets.sql'],
    ];
    const database = openMemoryDatabase();
    try {
      // An already-applied database recorded 202609030001 while the file
      // lived under Users ownership. The release moves the identical
      // bytes (same id, filename, checksum) to Auth ownership; the
      // ledger keys on id/name/checksum, never on the owning directory.
      const before = temporaryRoot();
      for (const [, name] of baseline) {
        // Old layout: identity tables lived under Users ownership.
        const source = baseline.find(([, candidate]) => candidate === name)!;
        writeMigration(before, 'users', name, migrationSql(source[0], name));
      }
      const first = migrate({ database, root: before });
      expect(first.applied).toHaveLength(7);
      expect(first.skipped).toEqual([]);
      database
        .prepare('INSERT INTO users (id, name, email, password, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
        .run('owner-move-user', 'Owner Move', 'owner-move@example.com', 'hash', 1, 1);

      const after = temporaryRoot();
      for (const [owner, name] of baseline) {
        writeMigration(after, owner, name, migrationSql(owner, name));
      }
      const second = migrate({ database, root: after });
      expect(second.applied).toEqual([]);
      expect(second.skipped).toHaveLength(7);
      expect(database.prepare('SELECT email FROM users WHERE id = ?').get('owner-move-user')).toEqual({
        email: 'owner-move@example.com',
      });
      expect(
        (database.prepare('SELECT checksum FROM _nara_migrations WHERE id = ?').get('202609030001') as { checksum: string })
          .checksum,
      ).toMatch(/^[a-f0-9]{64}$/);
    } finally {
      database.close();
    }
  });
  it('preserves asset data and required indexes through the owner-reference migration', () => {
    const database = openMemoryDatabase();
    try {
      database.exec(readFileSync(path.resolve('src/features/auth/server/migrations/202609030001_create_users.sql'), 'utf8'));
      database.exec(readFileSync(path.resolve('src/features/users/server/migrations/202609030007_create_assets.sql'), 'utf8'));
      database
        .prepare('INSERT INTO users (id, name, email, password, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
        .run('asset-owner', 'Asset Owner', 'asset-owner@example.com', 'hash', 1, 1);
      database
        .prepare(
          'INSERT INTO assets (id, name, type, url, mime_type, size, s3_key, user_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        )
        .run('asset-1', 'avatar.png', 'avatar', 'https://cdn.example/avatar.png', 'image/png', 42, 's3-key-1', 'asset-owner', 2, 3);

      // Only the forward owner-reference migration is pending: the ledger
      // bootstrap accepts 0001..0007 at their current locations by
      // id/name/shape, then 0008 rebuilds assets without a foreign key.
      const root = temporaryRoot();
      for (const [feature, name] of [
        ['auth', '202609030001_create_users.sql'],
        ['auth', '202609030002_create_sessions.sql'],
        ['auth', '202609030003_create_roles.sql'],
        ['auth', '202609030004_create_permissions.sql'],
        ['auth', '202609030005_create_role_permissions.sql'],
        ['auth', '202609030006_create_user_roles.sql'],
        ['users', '202609030007_create_assets.sql'],
      ] as const) {
        const source =
          feature === 'auth'
            ? path.resolve(`src/features/auth/server/migrations/${name}`)
            : path.resolve(`src/features/users/server/migrations/${name}`);
        writeMigration(root, feature, name, readFileSync(source, 'utf8'));
      }
      database.exec(readFileSync(path.resolve('src/features/auth/server/migrations/202609030002_create_sessions.sql'), 'utf8'));
      database.exec(readFileSync(path.resolve('src/features/auth/server/migrations/202609030003_create_roles.sql'), 'utf8'));
      database.exec(readFileSync(path.resolve('src/features/auth/server/migrations/202609030004_create_permissions.sql'), 'utf8'));
      database.exec(readFileSync(path.resolve('src/features/auth/server/migrations/202609030005_create_role_permissions.sql'), 'utf8'));
      database.exec(readFileSync(path.resolve('src/features/auth/server/migrations/202609030006_create_user_roles.sql'), 'utf8'));
      writeMigration(
        root,
        'users',
        '202609030008_assets_owner_reference.sql',
        readFileSync(path.resolve('src/features/users/server/migrations/202609030008_assets_owner_reference.sql'), 'utf8'),
      );

      const result = migrate({ database, root });
      expect(result.applied).toEqual(['202609030008_assets_owner_reference.sql']);
      expect(result.skipped).toHaveLength(7);
      expect(database.prepare('SELECT id, user_id, size FROM assets WHERE id = ?').get('asset-1')).toEqual({
        id: 'asset-1',
        user_id: 'asset-owner',
        size: 42,
      });
      expect(database.prepare('SELECT email FROM users WHERE id = ?').get('asset-owner')).toEqual({
        email: 'asset-owner@example.com',
      });
      const indexes = (
        database.prepare("SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'assets'").all() as Array<{
          name: string;
        }>
      ).map((row) => row.name);
      expect(indexes).toEqual(expect.arrayContaining(['idx_assets_user_id', 'idx_assets_s3_key']));
      expect(database.pragma('foreign_key_list(assets)')).toEqual([]);
    } finally {
      database.close();
    }
  });
});
