import { existsSync, mkdtempSync, readFileSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { newProject } from '../commands/new-project';
import { runCli, type CliIO } from '../router';

const fixtures: string[] = [];

afterEach(() => {
  for (const fixture of fixtures.splice(0)) {
    rmSync(fixture, { recursive: true, force: true });
  }
});

function createFixture(): string {
  const fixture = mkdtempSync(path.join(os.tmpdir(), 'nara-new-'));
  fixtures.push(fixture);
  return fixture;
}

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

describe('new project', () => {
  it('creates a runnable v3 project with opinionated defaults', () => {
    const fixture = createFixture();

    const result = newProject('ledger', fixture);

    if (!result.ok) {
      throw new Error(result.error.message);
    }
    const projectDirectory = result.project.directory;
    const packageJson: unknown = JSON.parse(readFileSync(path.join(projectDirectory, 'package.json'), 'utf8'));
    expect(packageJson).toMatchObject({
      scripts: { build: 'tsc', start: 'node build/server.js', test: 'vitest run' },
      dependencies: { hono: expect.any(String) },
    });
    expect(existsSync(path.join(projectDirectory, 'src/features/health/index.ts'))).toBe(true);
    expect(existsSync(path.join(projectDirectory, 'AGENTS.md'))).toBe(true);
  });

  it('rejects unsafe project names', () => {
    const fixture = createFixture();

    const result = newProject('../ledger', fixture);

    if (result.ok) {
      throw new Error('Expected unsafe project name to be rejected');
    }
    expect(result.error.message).toContain('Invalid project name');
  });

  it('refuses an existing project directory without overwriting it', () => {
    const fixture = createFixture();
    const projectDirectory = path.join(fixture, 'ledger');
    mkdirSync(projectDirectory, { recursive: true });
    writeFileSync(path.join(projectDirectory, 'sentinel'), 'existing\n');
    const io = createIO();

    const result = runCli(['new', 'ledger'], io, { cwd: fixture });

    expect(result.exitCode).toBe(73);
    expect(io.errors.join('')).toContain('nothing was overwritten');
    expect(readFileSync(path.join(projectDirectory, 'sentinel'), 'utf8')).toBe('existing\n');
  });
});
