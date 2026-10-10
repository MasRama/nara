import { execFile } from 'node:child_process';
import { mkdtempSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { describe, expect, it } from 'vitest';
import { ensurePackedNara, npmCommand, runLocalNara } from './pack-helpers';
const execFileAsync = promisify(execFile);

type CommandFailure = Error & {
  stdout?: string;
  stderr?: string;
};

type CommandResult = {
  stdout: string;
  stderr: string;
};

async function runProcess(command: string, args: string[], cwd: string): Promise<CommandResult> {
  try {
    const result = await execFileAsync(command, args, {
      cwd,
      env: { ...process.env },
      maxBuffer: 16 * 1024 * 1024,
    });
    return { stdout: result.stdout, stderr: result.stderr };
  } catch (error) {
    const failure = error as CommandFailure;
    const output = [failure.stdout, failure.stderr].filter(Boolean).join('\n');
    throw new Error(`${command} ${args.join(' ')} failed${output ? `\n${output}` : ''}`);
  }
}

describe('nara add official feature', () => {
  it('installs health into an existing Nara project and validates it', { timeout: 300_000 }, async () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'nara-add-integration-'));
    try {
      const projectDirectory = path.join(root, 'existing-app');
      mkdirSync(path.join(projectDirectory, 'src', 'app'), { recursive: true });
      writeFileSync(
        path.join(projectDirectory, 'src', 'app', 'server.ts'),
        "import { Hono } from 'hono';\n\nexport const app = new Hono();\n",
      );
      writeFileSync(
        path.join(projectDirectory, 'src', 'app', 'router.ts'),
        "import { createRouter, createWebHistory } from 'vue-router';\n\nexport default createRouter({ history: createWebHistory(), routes: [] });\n",
      );
      const tarball = await ensurePackedNara();
      writeFileSync(
        path.join(projectDirectory, 'package.json'),
        `${JSON.stringify({
          name: 'existing-app',
          private: true,
          devDependencies: { '@nara-web/cli': `file:${tarball}` },
        }, null, 2)}\n`,
      );
      await runProcess(npmCommand, ['install', '--no-audit', '--no-fund'], projectDirectory);

      // `nara add` and `nara doctor` run from the existing project's own tooling.
      const addResult = await runLocalNara(projectDirectory, ['add', 'health']);
      expect(addResult.stdout).toContain('src/features/health/index.ts');

      const healthDirectory = path.join(projectDirectory, 'src', 'features', 'health');
      expect(existsSync(healthDirectory)).toBe(true);
      expect(readFileSync(path.join(healthDirectory, 'index.ts'), 'utf8')).toContain('healthRoutes');
      expect(existsSync(path.join(healthDirectory, 'tests', 'health.test.ts'))).toBe(true);

      const doctorResult = await runLocalNara(projectDirectory, ['doctor']);
      expect(doctorResult.stdout).toBe('Architecture looks healthy.\n');
      expect(doctorResult.stderr).toBe('');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
