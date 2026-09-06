import { execFile } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { describe, expect, it } from 'vitest';
import { discoverMigrations } from '../../src/shared/database/migrator';
import {
  ensurePackedNara,
  npmCommand,
  publishablePackageDir,
  repoRoot,
  runCommand,
} from './pack-helpers';

const execFileAsync = promisify(execFile);

// Mirrors SUBSTRATE_FILES in scripts/stage-package.mjs and
// src/cli/commands/new-project.ts. Any drift fails the parity test below.
const SUBSTRATE_FILES = [
  'src/shared/database/index.ts',
  'src/shared/database/sqlite.ts',
  'src/shared/database/migrator.ts',
  'src/shared/database/seeder.ts',
  'src/shared/config/index.ts',
  'src/shared/config/constants.ts',
  'src/shared/config/env.ts',
] as const;

async function tarballEntries(tarball: string): Promise<string[]> {
  const { stdout } = await execFileAsync('tar', ['-tzf', tarball], { maxBuffer: 16 * 1024 * 1024 });
  return stdout
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

async function tarballFile(tarball: string, entry: string): Promise<string> {
  const { stdout } = await execFileAsync('tar', ['-xzOf', tarball, entry], { maxBuffer: 16 * 1024 * 1024 });
  return stdout;
}

describe('nara publishable tarball integrity', () => {
  it('ships the real artifact with official features and substrate, and no application state', async () => {
    const tarball = await ensurePackedNara();
    const entries = await tarballEntries(tarball);
    const files = new Set(entries.filter((entry) => !entry.endsWith('/')));

    for (const required of [
      'package/package.json',
      'package/README.md',
      'package/LICENSE',
      'package/dist/index.js',
      'package/official-features/health/index.ts',
      'package/official-features/health/contract.ts',
      'package/official-features/health/.nara/assembly/server.ts',
      'package/official-features/audit/index.ts',
      'package/official-features/audit/contract.ts',
      'package/official-features/users/index.ts',
      'package/official-features/users/contract.ts',
      'package/official-features/users/.nara/assembly/server.ts',
      'package/official-features/users/.nara/assembly/web.ts',
      'package/official-features/users/.nara/requirements.json',
      'package/substrate/src/shared/database/index.ts',
      'package/substrate/src/shared/database/sqlite.ts',
      'package/substrate/src/shared/database/migrator.ts',
      'package/substrate/src/shared/database/seeder.ts',
      'package/substrate/src/shared/config/index.ts',
      'package/substrate/src/shared/config/constants.ts',
      'package/substrate/src/shared/config/env.ts',
    ]) {
      expect(files.has(required)).toBe(true);
    }
    const allowedPrefixes = ['package/dist/', 'package/official-features/', 'package/substrate/'];
    const allowedRoots = new Set(['package/package.json', 'package/README.md', 'package/LICENSE']);
    for (const file of files) {
      const allowed = allowedRoots.has(file) || allowedPrefixes.some((prefix) => file.startsWith(prefix));
      expect(allowed, `${file} is outside the publishable file set`).toBe(true);
    }

    // The packed manifest carries the release version authority.
    const packedManifest = JSON.parse(await tarballFile(tarball, 'package/package.json')) as { version: string };
    const sourceManifest = JSON.parse(
      readFileSync(path.join(publishablePackageDir(), 'package.json'), 'utf8'),
    ) as { version: string };
    expect(packedManifest.version).toBe(sourceManifest.version);
  });

  it('stages the exact repository substrate bytes', () => {
    const repository = repoRoot();
    for (const relative of SUBSTRATE_FILES) {
      const source = readFileSync(path.join(repository, ...relative.split('/')), 'utf8');
      const staged = readFileSync(
        path.join(publishablePackageDir(), 'substrate', ...relative.split('/')),
        'utf8',
      );
      expect(staged).toBe(source);
    }
    expect(readFileSync(path.join(publishablePackageDir(), 'LICENSE'), 'utf8')).toBe(
      readFileSync(path.join(repository, 'LICENSE'), 'utf8'),
    );
  });

  it('generates projects from the packed CLI with byte-identical substrate and no tables', { timeout: 300_000 }, async () => {
    const tarball = await ensurePackedNara();
    const root = mkdtempSync(path.join(os.tmpdir(), 'nara-tarball-substrate-'));
    try {
      const prefix = path.join(root, 'prefix');
      await runCommand(npmCommand, ['install', '--prefix', prefix, tarball], root);
      const installedCli =
        process.platform === 'win32'
          ? ['node', path.join(prefix, 'node_modules', '@nara-web', 'cli', 'dist', 'index.js')]
          : [path.join(prefix, 'node_modules', '.bin', 'nara')];

      const workspace = path.join(root, 'workspace');
      mkdirSync(workspace, { recursive: true });
      await runCommand(installedCli[0], [...installedCli.slice(1), 'new', 'substrate-app'], workspace);
      const projectDirectory = path.join(workspace, 'substrate-app');

      for (const relative of SUBSTRATE_FILES) {
        const source = readFileSync(path.join(repoRoot(), ...relative.split('/')), 'utf8');
        const generated = readFileSync(path.join(projectDirectory, ...relative.split('/')), 'utf8');
        expect(generated).toBe(source);
      }

      // Health-only projects carry the persistence engine but no
      // application tables until persistent Features provide migrations.
      expect(discoverMigrations({ root: projectDirectory })).toEqual([]);
      expect(existsSync(path.join(projectDirectory, 'src', 'features', 'health', 'server', 'migrations'))).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
