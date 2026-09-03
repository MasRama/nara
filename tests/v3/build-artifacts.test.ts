import { execFile } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import { afterEach, describe, expect, it } from 'vitest';

const execFileAsync = promisify(execFile);
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const staleArtifacts: string[] = [];

async function runBuild(): Promise<void> {
  await execFileAsync(npmCommand, ['run', 'build'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      NODE_ENV: 'development',
      APP_URL: 'http://127.0.0.1:5555',
    },
    maxBuffer: 16 * 1024 * 1024,
  });
}

afterEach(() => {
  for (const artifact of staleArtifacts.splice(0)) {
    rmSync(artifact, { force: true });
  }
});

describe('production build artifacts', () => {
  it('removes deleted migration and seed artifacts before rebuilding', { timeout: 120_000 }, async () => {
    await runBuild();

    const staleRoot = path.join(process.cwd(), 'build', 'src', 'features', 'auth', 'server');
    const staleMigration = path.join(staleRoot, 'migrations', '999999999999_deleted_migration.sql');
    const staleSeed = path.join(staleRoot, 'seeds', '999999999999_deleted_seed.js');
    staleArtifacts.push(staleMigration, staleSeed);
    mkdirSync(path.dirname(staleMigration), { recursive: true });
    mkdirSync(path.dirname(staleSeed), { recursive: true });
    writeFileSync(staleMigration, 'CREATE TABLE stale_migration (id TEXT PRIMARY KEY);\n');
    writeFileSync(staleSeed, 'module.exports.run = () => undefined;\n');

    expect(existsSync(staleMigration)).toBe(true);
    expect(existsSync(staleSeed)).toBe(true);

    await runBuild();

    expect(existsSync(staleMigration)).toBe(false);
    expect(existsSync(staleSeed)).toBe(false);
    expect(existsSync(path.join(staleRoot, 'migrations', '202609030002_create_sessions.sql'))).toBe(true);
    expect(existsSync(path.join(staleRoot, 'seeds', '202609030001_permissions.js'))).toBe(true);
  });
});
