import { spawn, type ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { execFile } from 'node:child_process';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const execFileAsync = promisify(execFile);
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const projectRoot = process.cwd();

let server: ChildProcess | undefined;
let serverOutput = '';
let baseUrl = '';
let serverPid = 0;
let tempDirectory = '';

function walkFiles(directory: string, extension: (file: string) => boolean, found: string[] = []): string[] {
  for (const entry of readdirSync(directory)) {
    const absolute = path.join(directory, entry);
    if (statSync(absolute).isDirectory()) {
      if (entry === 'node_modules' || entry === 'build' || entry === '.git') continue;
      walkFiles(absolute, extension, found);
    } else if (extension(absolute)) {
      found.push(absolute);
    }
  }
  return found;
}

function findFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = createServer();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const address = probe.address();
      if (address && typeof address === 'object') {
        const port = address.port;
        probe.close(() => resolve(port));
      } else {
        probe.close(() => reject(new Error('Could not determine a free port')));
      }
    });
  });
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function waitForServer(): Promise<void> {
  if (!server) throw new Error('Production server was not started');
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) {
      throw new Error(`Production server exited with code ${server.exitCode}.\n${serverOutput}`);
    }
    try {
      const response = await fetch(`${baseUrl}/health`);
      if (response.status === 200) return;
    } catch {
      // The server may still be binding its port.
    }
    await delay(100);
  }
  throw new Error(`Production server did not answer ${baseUrl}/health within 30 seconds.\n${serverOutput}`);
}

async function stopProductionServer(): Promise<void> {
  if (!server || server.exitCode !== null) return;
  server.kill('SIGTERM');
  await Promise.race([
    once(server, 'exit'),
    delay(5_000).then(() => {
      throw new Error(`Production server did not stop cleanly.\n${serverOutput}`);
    }),
  ]);
}

beforeAll(async () => {
  if (!existsSync(path.join(projectRoot, 'build', 'server.js'))) {
    await execFileAsync(npmCommand, ['run', 'build'], { cwd: projectRoot });
  }
  tempDirectory = mkdtempSync(path.join(os.tmpdir(), 'nara-linux-deployment-'));
  const port = await findFreePort();
  baseUrl = `http://127.0.0.1:${port}`;
  server = spawn(npmCommand, ['start'], {
    cwd: projectRoot,
    env: {
      ...process.env,
      NODE_ENV: 'production',
      PORT: String(port),
      APP_URL: baseUrl,
      DB_FILE: path.join(tempDirectory, 'linux-deployment.sqlite3'),
      LOG_LEVEL: 'info',
      LOG_PRETTY: 'false',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (!server.pid) throw new Error('Production server did not report a pid');
  serverPid = server.pid;
  server.stdout?.setEncoding('utf8');
  server.stderr?.setEncoding('utf8');
  server.stdout?.on('data', (chunk: string) => {
    serverOutput += chunk;
  });
  server.stderr?.on('data', (chunk: string) => {
    serverOutput += chunk;
  });
  await waitForServer();
}, 120_000);

afterAll(async () => {
  await stopProductionServer();
  if (tempDirectory) rmSync(tempDirectory, { recursive: true, force: true });
});

/**
 * V3-111: the old Ultimate Express / uWebSockets.js HTTP path required a
 * newer glibc than supported Linux baselines shipped, failing before the
 * application started. The Hono + @hono/node-server path must carry no such
 * native HTTP binary, and the real production server must start and answer
 * HTTP on Linux.
 */
describe('linux deployment baseline (V3-111)', () => {
  it('declares no Ultimate Express / uWebSockets HTTP dependency', () => {
    const manifest = JSON.parse(readFileSync(path.join(projectRoot, 'package.json'), 'utf-8')) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const declared = [...Object.keys(manifest.dependencies ?? {}), ...Object.keys(manifest.devDependencies ?? {})];
    expect(declared).toContain('hono');
    expect(declared).toContain('@hono/node-server');
    for (const banned of ['ultimate-express', 'uWebSockets.js', 'uwebsockets.js']) {
      expect(declared, banned).not.toContain(banned);
    }
  });

  it('pins no Ultimate/uWS package in the lockfile', () => {
    const lockfile = readFileSync(path.join(projectRoot, 'package-lock.json'), 'utf-8');
    expect(lockfile).not.toMatch(/node_modules\/ultimate-express/);
    expect(lockfile).not.toMatch(/node_modules\/uwebsockets/i);
  });

  it('imports no Ultimate/uWS HTTP runtime from active sources', () => {
    const sources = walkFiles(
      projectRoot,
      (file) => /\.(ts|vue)$/.test(file) && /[\\/]src[\\/]|[\\/]scripts[\\/]|[\\/]resources[\\/]/.test(file),
    );
    const bannedImport =
      /(?:from|import|require)\s*\(?\s*['"](?:ultimate-express|uwebsockets\.js)['"]/i;
    const hits = sources.filter((file) => bannedImport.test(readFileSync(file, 'utf-8')));
    expect(hits).toEqual([]);
  });

  it('ships no native binary inside the HTTP adapter path', () => {
    for (const adapterRoot of ['node_modules/@hono', 'node_modules/hono']) {
      const absolute = path.join(projectRoot, adapterRoot);
      if (!existsSync(absolute)) continue;
      const natives = walkFiles(absolute, (file) => /\.(node|so)(\.|$)/.test(file));
      expect(natives, adapterRoot).toEqual([]);
    }
  });

  it('keeps the generated starter on the same native-free HTTP stack', () => {
    const template = readFileSync(path.join(projectRoot, 'src', 'cli', 'commands', 'new-project.ts'), 'utf-8');
    expect(template).toMatch(/@hono\/node-server/);
    expect(template).not.toMatch(/ultimate-express|uwebsockets\.js/i);
  });

  it('starts the real production server and answers health on Linux', async () => {
    const health = await fetch(`${baseUrl}/health`);
    expect(health.status).toBe(200);
    await expect(health.json()).resolves.toEqual({ status: 'ok' });

    const ready = await fetch(`${baseUrl}/ready`);
    expect(ready.status).toBe(200);
    await expect(ready.json()).resolves.toEqual({ status: 'ok' });

    const me = await fetch(`${baseUrl}/api/auth/me`);
    expect(me.status).toBe(401);
  });

  it('maps no uWS native binary into the running production process', async () => {
    if (process.platform !== 'linux') return;
    const maps = readFileSync(`/proc/${serverPid}/maps`, 'utf-8');
    expect(maps).not.toMatch(/uws|uwebsocket/i);
  });
});
