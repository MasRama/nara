import { execFile, spawn, type ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { mkdtempSync, rmSync } from 'node:fs';
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

async function runCommand(command: string, args: string[], cwd: string): Promise<void> {
  try {
    await execFileAsync(command, args, {
      cwd,
      env: { ...process.env },
      maxBuffer: 16 * 1024 * 1024,
    });
  } catch (error) {
    const failure = error as CommandFailure;
    const output = [failure.stdout, failure.stderr].filter(Boolean).join('\n');
    throw new Error(`${command} ${args.join(' ')} failed${output ? `\n${output}` : ''}`);
  }
}

function delay(milliseconds: number): Promise<void> {
  const { promise, resolve } = Promise.withResolvers<void>();
  setTimeout(resolve, milliseconds);
  return promise;
}

function findFreePort(): Promise<number> {
  const { promise, resolve, reject } = Promise.withResolvers<number>();
  const server = createServer();
  server.once('error', reject);
  server.listen(0, '127.0.0.1', () => {
    const address = server.address();
    if (!address || typeof address === 'string') {
      server.close();
      reject(new Error('Could not determine a free TCP port'));
      return;
    }
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(address.port);
    });
  });
  return promise;
}

function startGeneratedServer(projectDirectory: string, port: number): { child: ChildProcess; output: () => string } {
  const child = spawn(process.execPath, ['build/server.js'], {
    cwd: projectDirectory,
    env: { ...process.env, PORT: String(port) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  child.stdout?.setEncoding('utf8');
  child.stderr?.setEncoding('utf8');
  child.stdout?.on('data', (chunk: string) => {
    output += chunk;
  });
  child.stderr?.on('data', (chunk: string) => {
    output += chunk;
  });
  return { child, output: () => output };
}

async function waitForExit(child: ChildProcess, milliseconds: number): Promise<boolean> {
  if (child.exitCode !== null) return true;
  return Promise.race([
    once(child, 'exit').then(() => true),
    delay(milliseconds).then(() => false),
  ]);
}

async function stopGeneratedServer(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null) return;
  child.kill('SIGTERM');
  if (await waitForExit(child, 5_000)) return;
  if (child.exitCode === null) child.kill('SIGKILL');
  if (!(await waitForExit(child, 5_000))) {
    throw new Error('Generated server did not terminate after SIGTERM and SIGKILL');
  }
}

async function waitForHealth(child: ChildProcess, port: number, output: () => string): Promise<void> {
  const url = `http://127.0.0.1:${port}/health`;
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`Generated server exited with code ${child.exitCode}.\n${output()}`);
    }
    try {
      const response = await fetch(url);
      if (response.status === 200) return;
    } catch {
      // The server may still be binding its port.
    }
    await delay(100);
  }
  throw new Error(`Generated server did not answer ${url} within 30 seconds.\n${output()}`);
}

describe('nara new fresh project', () => {
  it('installs, checks, validates, builds, starts, and serves health', { timeout: 300_000 }, async () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'nara-new-integration-'));
    try {
      const result = runCli(['new', 'fresh-app'], createIO(), { cwd: root });
      expect(result.exitCode).toBe(0);

      const projectDirectory = path.join(root, 'fresh-app');
      await runCommand(npmCommand, ['install', '--no-audit', '--no-fund'], projectDirectory);
      await runCommand(npmCommand, ['run', 'typecheck'], projectDirectory);
      await runCommand(npmCommand, ['run', 'typecheck:frontend'], projectDirectory);
      await runCommand(npmCommand, ['test'], projectDirectory);
      await runCommand(npmCommand, ['run', 'check'], projectDirectory);

      const doctorIO = createIO();
      const doctorResult = runCli(['doctor'], doctorIO, { cwd: projectDirectory });
      expect(doctorResult.exitCode).toBe(0);
      expect(doctorIO.output.join('')).toBe('Architecture looks healthy.\n');
      expect(doctorIO.errors).toHaveLength(0);
      await runCommand(npmCommand, ['run', 'build'], projectDirectory);

      const port = await findFreePort();
      const generatedServer = startGeneratedServer(projectDirectory, port);
      try {
        await waitForHealth(generatedServer.child, port, generatedServer.output);
        const response = await fetch(`http://127.0.0.1:${port}/health`);
        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toEqual({ status: 'ok' });
      } finally {
        await stopGeneratedServer(generatedServer.child);
      }
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
