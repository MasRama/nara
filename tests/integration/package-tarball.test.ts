import { execFile } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import { describe, expect, it } from 'vitest';
import { ensurePackedNara, publishablePackageDir } from './pack-helpers';

const execFileAsync = promisify(execFile);

async function tarballEntries(tarball: string): Promise<string[]> {
  const { stdout } = await execFileAsync('tar', ['-tzf', tarball], { maxBuffer: 16 * 1024 * 1024 });
  return stdout.split('\n').map((line) => line.trim()).filter(Boolean);
}

async function tarballFile(tarball: string, entry: string): Promise<string> {
  const { stdout } = await execFileAsync('tar', ['-xzOf', tarball, entry], { maxBuffer: 16 * 1024 * 1024 });
  return stdout;
}

describe('nara publishable tarball integrity', () => {
  it('ships the CLI and official features without application state or scaffolding substrate', async () => {
    const tarball = await ensurePackedNara();
    const files = new Set((await tarballEntries(tarball)).filter((entry) => !entry.endsWith('/')));
    for (const required of [
      'package/package.json',
      'package/README.md',
      'package/LICENSE',
      'package/dist/index.js',
      'package/official-features/health/index.ts',
      'package/official-features/audit/index.ts',
      'package/official-features/users/index.ts',
      'package/official-features/users/.nara/assembly/server.ts',
      'package/official-features/users/.nara/assembly/web.ts',
    ]) expect(files.has(required)).toBe(true);
    expect([...files].some((file) => file.startsWith('package/substrate/'))).toBe(false);
    expect(files.has('package/dist/commands/new-project.js')).toBe(false);
    const allowedPrefixes = ['package/dist/', 'package/official-features/'];
    const allowedRoots = new Set(['package/package.json', 'package/README.md', 'package/LICENSE']);
    for (const file of files) {
      expect(allowedRoots.has(file) || allowedPrefixes.some((prefix) => file.startsWith(prefix)), file).toBe(true);
    }
    const packedManifest = JSON.parse(await tarballFile(tarball, 'package/package.json')) as { version: string };
    const sourceManifest = JSON.parse(readFileSync(path.join(publishablePackageDir(), 'package.json'), 'utf8')) as { version: string };
    expect(packedManifest.version).toBe(sourceManifest.version);
  });
});
