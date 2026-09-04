import { spawn, type ChildProcess } from 'node:child_process';
import { createServer } from 'node:net';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { execFile } from 'node:child_process';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const execFileAsync = promisify(execFile);
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const projectRoot = process.cwd();
const isLinux = process.platform === 'linux';
// The real production entrypoint executed by `npm start`
// (`package.json`: `"start": "node build/server.js"`). The test spawns this
// file directly with the current Node binary so `server.pid` is the actual
// production Node process — not an npm wrapper — and `/proc/<pid>/maps`
// inspects the real server.
const serverEntry = path.join(projectRoot, 'build', 'server.js');

let server: ChildProcess | undefined;
let serverOutput = '';
let baseUrl = '';
let serverPid = 0;
let tempDirectory = '';

function findFreePort(): Promise<number> {
  // Real socket bind: must observe the platform allocator, not a fake clock.
  const { promise, resolve, reject } = Promise.withResolvers<number>();
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
  return promise;
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

function waitForExitEvent(child: ChildProcess, milliseconds: number): Promise<boolean> {
  if (child.exitCode !== null) return Promise.resolve(true);
  return new Promise((resolve) => {
    const onExit = () => {
      clearTimeout(timer);
      resolve(true);
    };
    const timer = setTimeout(() => {
      child.removeListener('exit', onExit);
      resolve(false);
    }, milliseconds);
    timer.unref?.();
    child.once('exit', onExit);
  });
}

async function stopProductionServer(): Promise<void> {
  const child = server;
  if (!child || child.exitCode !== null) return;
  try {
    child.kill('SIGTERM');
  } catch {
    return;
  }
  if (await waitForExitEvent(child, 5_000)) return;
  try {
    child.kill('SIGKILL');
  } catch {
    // Already gone; final bounded wait below resolves immediately.
  }
  await waitForExitEvent(child, 5_000);
}

beforeAll(async () => {
  if (!isLinux) {
    throw new Error(
      'test:linux-deployment requires Linux (process.platform === \'linux\'). ' +
        'A non-Linux run cannot produce Linux deployment evidence. ' +
        'Run `npm run test:http-stack-compat` for the portable HTTP-stack audit instead.',
    );
  }
  // Release gate semantics: always prove the current source state. Never
  // trust a possibly stale build/server.js from an earlier run.
  await execFileAsync(npmCommand, ['run', 'build'], { cwd: projectRoot });
  tempDirectory = mkdtempSync(path.join(os.tmpdir(), 'nara-linux-deployment-'));
  const port = await findFreePort();
  baseUrl = `http://127.0.0.1:${port}`;
  server = spawn(process.execPath, [serverEntry], {
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
  try {
    await waitForServer();
  } catch (error) {
    // A failure in setup must not orphan the production server.
    await stopProductionServer();
    throw error;
  }
}, 180_000);

afterAll(async () => {
  try {
    await stopProductionServer();
  } finally {
    if (tempDirectory) {
      rmSync(tempDirectory, { recursive: true, force: true });
      tempDirectory = '';
    }
  }
});

/**
 * V3-111: the old Ultimate Express / uWebSockets.js HTTP path failed before
 * the application started on Linux hosts whose system libraries did not
 * match its native binary. This gate proves the real production artifact
 * starts and answers HTTP on a real Linux environment and loads no uWS
 * native binary.
 *
 * `server.pid` is the actual `node build/server.js` process (spawned
 * directly, no npm wrapper), so `/proc/<pid>/maps` below inspects the real
 * production server. The assertion is narrow: no uWS/uWebSockets mapping in
 * the running server. It does not claim all native dependencies are absent.
 *
 * Contract is narrow: the Hono + @hono/node-server HTTP path carries no
 * Ultimate/uWS native HTTP runtime. Other native dependencies (e.g.
 * better-sqlite3, Sharp) are legitimate and out of scope.
 *
 * Portable dependency/import hygiene lives in
 * `tests/integration/http-stack-compat.test.ts` and runs everywhere. This
 * file is the Linux-only runtime half: it fails fast on non-Linux so a
 * macOS/Windows run can never be mistaken for Linux validation.
 */
describe('linux deployment (V3-111)', () => {
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
    const maps = readFileSync(`/proc/${serverPid}/maps`, 'utf-8');
    expect(maps).not.toMatch(/uws|uwebsocket/i);
  });
});
