import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { discoverMigrations } from '../../src/shared/database/migrator';
import { ensurePackedNara, npmCommand, repoRoot, runCommand } from './pack-helpers';

// Mirrors SUBSTRATE_FILES in scripts/stage-package.mjs and
// tests/integration/package-tarball.test.ts. Any drift fails the parity check below.
const SUBSTRATE_FILES = [
  'src/shared/database/index.ts',
  'src/shared/database/sqlite.ts',
  'src/shared/database/migrator.ts',
  'src/shared/database/seeder.ts',
  'src/shared/config/index.ts',
  'src/shared/config/constants.ts',
  'src/shared/config/env.ts',
] as const;

function writeExplodingStub(stubModules: string, name: string): void {
  const stubPackage = path.join(stubModules, name);
  mkdirSync(stubPackage, { recursive: true });
  writeFileSync(
    path.join(stubPackage, 'package.json'),
    `${JSON.stringify({ name, version: '0.0.0-stub', main: 'index.js' })}\n`,
  );
  writeFileSync(path.join(stubPackage, 'index.js'), `throw new Error('eager ${name} load from packed CLI');\n`);
}

describe('packed CLI runtime boundary', () => {
  it('runs unrelated commands without the transition SQLite runtime', { timeout: 300_000 }, async () => {
    const tarball = await ensurePackedNara();
    const root = mkdtempSync(path.join(os.tmpdir(), 'nara-packed-boundary-'));
    try {
      const prefix = path.join(root, 'prefix');
      await runCommand(npmCommand, ['install', '--prefix', prefix, tarball], root);
      // If the packed CLI eagerly requires the transition SQLite runtime
      // (or its dotenv/zod chain) at startup, Node falls back to NODE_PATH,
      // loads one of these stubs, and the command below explodes.
      const stubModules = path.join(root, 'stub_modules');
      for (const name of ['better-sqlite3', 'dotenv', 'zod']) writeExplodingStub(stubModules, name);
      const stubEnv = { NODE_PATH: stubModules };
      const nara =
        process.platform === 'win32'
          ? (['node', path.join(prefix, 'node_modules', '@nara-web', 'cli', 'dist', 'index.js')] as const)
          : ([path.join(prefix, 'node_modules', '.bin', 'nara')] as const);

      const workspace = path.join(root, 'workspace');
      mkdirSync(workspace, { recursive: true });
      await runCommand(nara[0], [...nara.slice(1), 'new', 'substrate-app'], workspace, stubEnv);
      const projectDirectory = path.join(workspace, 'substrate-app');

      await runCommand(nara[0], [...nara.slice(1), 'doctor'], projectDirectory, stubEnv);
      await runCommand(nara[0], [...nara.slice(1), 'inspect', 'health'], projectDirectory, stubEnv);

      for (const relative of SUBSTRATE_FILES) {
        const source = readFileSync(path.join(repoRoot(), ...relative.split('/')), 'utf8');
        const generated = readFileSync(path.join(projectDirectory, ...relative.split('/')), 'utf8');
        expect(generated).toBe(source);
      }
      expect(discoverMigrations({ root: projectDirectory })).toEqual([]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
