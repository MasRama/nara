import { execFile } from 'node:child_process';
import { mkdtempSync, existsSync, readFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { describe, expect, it } from 'vitest';
import { runCli, type CliIO } from '../../src/cli/router';

const execFileAsync = promisify(execFile);
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';

type CommandFailure = Error & {
  stdout?: string;
  stderr?: string;
};

type CommandResult = {
  stdout: string;
  stderr: string;
};

function createIO(): CliIO & { output: string[]; errors: string[] } {
  const output: string[] = [];
  const errors: string[] = [];
  return {
    output,
    errors,
    stdout: (message) => output.push(message),
    stderr: (message) => errors.push(message),
  };
}

async function runCommand(command: string, args: string[], cwd: string): Promise<CommandResult> {
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
  it('installs audit into a clean generated project and validates it', { timeout: 300_000 }, async () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'nara-add-integration-'));
    try {
      const newResult = runCli(['new', 'clean-app'], createIO(), { cwd: root });
      expect(newResult.exitCode).toBe(0);

      const projectDirectory = path.join(root, 'clean-app');
      await runCommand(npmCommand, ['install', '--no-audit', '--no-fund'], projectDirectory);

      const addIO = createIO();
      const addResult = runCli(['add', 'audit'], addIO, { cwd: projectDirectory });
      expect(addResult.exitCode).toBe(0);
      expect(addIO.output.join('')).toContain('src/features/audit/index.ts');

      const auditDirectory = path.join(projectDirectory, 'src', 'features', 'audit');
      expect(existsSync(auditDirectory)).toBe(true);
      expect(readFileSync(path.join(auditDirectory, 'index.ts'), 'utf8')).toContain('createAuditEvent');
      expect(existsSync(path.join(auditDirectory, 'tests', 'audit.test.ts'))).toBe(true);

      await runCommand(npmCommand, ['run', 'typecheck'], projectDirectory);
      await runCommand(npmCommand, ['run', 'typecheck:frontend'], projectDirectory);
      const testResult = await runCommand(npmCommand, ['test'], projectDirectory);
      expect(testResult.stdout).toMatch(/Test Files\s+2 passed/);
      expect(testResult.stdout).toMatch(/Tests\s+2 passed/);

      const checkResult = await runCommand(npmCommand, ['run', 'check'], projectDirectory);
      expect(checkResult.stdout).toMatch(/Test Files\s+2 passed/);
      expect(checkResult.stdout).toMatch(/Tests\s+2 passed/);

      const doctorIO = createIO();
      const doctorResult = runCli(['doctor'], doctorIO, { cwd: projectDirectory });
      expect(doctorResult.exitCode).toBe(0);
      expect(doctorIO.output.join('')).toBe('Architecture looks healthy.\n');
      expect(doctorIO.errors).toHaveLength(0);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
