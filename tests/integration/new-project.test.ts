import { execFile, spawn, type ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
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

async function findDistinctPorts(): Promise<{ vitePort: number; serverPort: number }> {
  const vitePort = await findFreePort();
  let serverPort = await findFreePort();
  while (serverPort === vitePort) {
    serverPort = await findFreePort();
  }
  return { vitePort, serverPort };
}

function startGeneratedDevServer(
  projectDirectory: string,
  vitePort: number,
  serverPort: number,
): { child: ChildProcess; output: () => string } {
  const child = spawn(npmCommand, ['run', 'dev'], {
    cwd: projectDirectory,
    env: { ...process.env, PORT: String(serverPort), VITE_PORT: String(vitePort) },
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: process.platform !== 'win32',
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

async function waitForDevelopmentHealth(
  child: ChildProcess,
  vitePort: number,
  output: () => string,
): Promise<void> {
  const frontendUrl = `http://127.0.0.1:${vitePort}/`;
  const healthUrl = `http://127.0.0.1:${vitePort}/health`;
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`Generated development process exited with code ${child.exitCode}.\n${output()}`);
    }
    try {
      const frontendResponse = await fetch(frontendUrl);
      if (frontendResponse.status === 200) {
        const healthResponse = await fetch(healthUrl);
        if (healthResponse.status === 200) return;
      }
    } catch {
      // Vite and Hono may still be binding their ports.
    }
    await delay(100);
  }
  throw new Error(`Generated development server did not answer ${healthUrl} within 30 seconds.\n${output()}`);
}

async function expectUnavailable(url: string): Promise<void> {
  const deadline = Date.now() + 5_000;
  while (Date.now() < deadline) {
    try {
      await fetch(url);
    } catch {
      return;
    }
    await delay(100);
  }
  throw new Error(`Process remained available at ${url} after shutdown`);
}


function startGeneratedServer(projectDirectory: string, port: number): { child: ChildProcess; output: () => string } {
  const browserUrl = `http://127.0.0.1:${port}`;
  const child = spawn(process.execPath, ['build/server.js'], {
    cwd: projectDirectory,
    env: { ...process.env, NODE_ENV: 'production', PORT: String(port), APP_URL: browserUrl },
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

async function stopGeneratedDevServer(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null) return;
  if (process.platform !== 'win32' && child.pid !== undefined) {
    process.kill(-child.pid, 'SIGTERM');
  } else {
    child.kill('SIGTERM');
  }
  if (await waitForExit(child, 5_000)) return;
  if (child.exitCode === null) {
    if (process.platform !== 'win32' && child.pid !== undefined) {
      process.kill(-child.pid, 'SIGKILL');
    } else {
      child.kill('SIGKILL');
    }
  }
  if (!(await waitForExit(child, 5_000))) {
    throw new Error('Generated development process did not terminate after SIGTERM and SIGKILL');
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
  it('installs, runs full-stack dev, checks, validates, builds, starts, and serves health and browser assets', { timeout: 300_000 }, async () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'nara-new-integration-'));
    try {
      const result = runCli(['new', 'fresh-app'], createIO(), { cwd: root });
      expect(result.exitCode).toBe(0);

      const projectDirectory = path.join(root, 'fresh-app');
      await runCommand(npmCommand, ['install', '--no-audit', '--no-fund'], projectDirectory);

      const { vitePort, serverPort } = await findDistinctPorts();
      const generatedDevServer = startGeneratedDevServer(projectDirectory, vitePort, serverPort);
      try {
        await waitForDevelopmentHealth(generatedDevServer.child, vitePort, generatedDevServer.output);
        const response = await fetch(`http://127.0.0.1:${vitePort}/health`);
        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toEqual({ status: 'ok' });
      } finally {
        await stopGeneratedDevServer(generatedDevServer.child);
      }
      await expectUnavailable(`http://127.0.0.1:${vitePort}/`);
      await expectUnavailable(`http://127.0.0.1:${serverPort}/health`);
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

        const shellResponse = await fetch(`http://127.0.0.1:${port}/`);
        expect(shellResponse.status).toBe(200);
        expect(shellResponse.headers.get('content-type')).toContain('text/html');
        expect(shellResponse.headers.get('cache-control')).toBe('no-cache');
        expect(await shellResponse.text()).toContain('<div id="app"></div>');

        const unknownRouteResponse = await fetch(`http://127.0.0.1:${port}/unknown-browser-route`);
        expect(unknownRouteResponse.status).toBe(200);
        expect(unknownRouteResponse.headers.get('content-type')).toContain('text/html');
        expect(unknownRouteResponse.headers.get('cache-control')).toBe('no-cache');

        const assetFiles = readdirSync(path.join(projectDirectory, 'build', 'client', 'assets'));
        const javascript = assetFiles.find((file) => file.endsWith('.js'));
        if (!javascript) throw new Error('Generated production build did not emit a JavaScript asset');
        const assetResponse = await fetch(`http://127.0.0.1:${port}/assets/${javascript}`);
        expect(assetResponse.status).toBe(200);
        expect(assetResponse.headers.get('content-type')).toContain('javascript');
        expect(assetResponse.headers.get('cache-control')).toBe('public, max-age=31536000, immutable');

        const missingAssetResponse = await fetch(`http://127.0.0.1:${port}/assets/missing.js`);
        expect(missingAssetResponse.status).toBe(404);
        expect(missingAssetResponse.headers.get('content-type')).not.toContain('text/html');
        expect(missingAssetResponse.headers.get('cache-control')).toBe('no-store');
        expect(await missingAssetResponse.text()).not.toContain('<div id="app"></div>');

        expect(generatedServer.output()).toContain(`Browser/API: http://127.0.0.1:${port}`);
      } finally {
        await stopGeneratedServer(generatedServer.child);
      }
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
