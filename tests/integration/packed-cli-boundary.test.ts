import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { ensurePackedNara, npmCommand, runCommand } from './pack-helpers';

function writeExplodingStub(stubModules: string, name: string): void {
  const stubPackage = path.join(stubModules, name);
  mkdirSync(stubPackage, { recursive: true });
  writeFileSync(path.join(stubPackage, 'package.json'), `${JSON.stringify({ name, version: '0.0.0-stub', main: 'index.js' })}\n`);
  writeFileSync(path.join(stubPackage, 'index.js'), `throw new Error('eager ${name} load from packed CLI');\n`);
}

describe('packed CLI runtime boundary', () => {
  it('runs architecture commands against an existing project without eager runtime dependencies', { timeout: 300_000 }, async () => {
    const tarball = await ensurePackedNara();
    const root = mkdtempSync(path.join(os.tmpdir(), 'nara-packed-boundary-'));
    try {
      const prefix = path.join(root, 'prefix');
      await runCommand(npmCommand, ['install', '--prefix', prefix, tarball], root);
      const stubModules = path.join(root, 'stub_modules');
      for (const name of ['better-sqlite3', 'dotenv', 'zod']) writeExplodingStub(stubModules, name);
      const nara = process.platform === 'win32'
        ? (['node', path.join(prefix, 'node_modules', '@nara-web', 'cli', 'dist', 'index.js')] as const)
        : ([path.join(prefix, 'node_modules', '.bin', 'nara')] as const);
      const fixture = path.join(root, 'existing-app');
      mkdirSync(path.join(fixture, 'src', 'features', 'health'), { recursive: true });
      writeFileSync(path.join(fixture, 'src', 'features', 'health', 'index.ts'), 'export const healthRoutes = true;\n');
      writeFileSync(path.join(fixture, 'src', 'features', 'health', 'contract.ts'), 'export interface HealthStatus { status: string }\n');
      const env = { NODE_PATH: stubModules };
      expect((await runCommand(nara[0], [...nara.slice(1), 'doctor'], fixture, env)).stdout).toBe('Architecture looks healthy.\n');
      expect((await runCommand(nara[0], [...nara.slice(1), 'inspect', 'health'], fixture, env)).stdout).toContain('Feature: health');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
