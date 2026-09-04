import { spawn, type ChildProcess } from 'node:child_process';
import { once } from 'node:events';
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
  if (!isLinux) {
    throw new Error(
      'test:linux-deployment requires Linux (process.platform === \'linux\'). ' +
        'A non-Linux run cannot produce Ubuntu/glibc deployment evidence. ' +
        'Run `npm run test:http-stack-compat` for the portable HTTP-stack audit instead.',
    );
  }
  // Release gate semantics: always prove the current source state. Never
  // trust a possibly stale build/server.js from an earlier run.
  await execFileAsync(npmCommand, ['run', 'build'], { cwd: projectRoot });
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
}, 180_000);

afterAll(async () => {
  await stopProductionServer();
  if (tempDirectory) rmSync(tempDirectory, { recursive: true, force: true });
});

/**
 * V3-111: the old Ultimate Express / uWebSockets.js HTTP path required a
 * newer glibc than supported Linux baselines shipped, failing before the
 * application started. This gate proves the real production artifact starts
 * and answers HTTP on Linux and loads no uWS native binary.
 *
 * Contract is narrow: the Hono + @hono/node-server HTTP path carries no
 * Ultimate/uWS native HTTP runtime. Other native dependencies (e.g.
 * better-sqlite3, Sharp) are legitimate and out of scope.
 *
 * Portable dependency/import hygiene lives in
 * `tests/integration/http-stack-compat.test.ts` and runs everywhere. This
 * file is the Linux-only runtime half: it fails fast on non-Linux so a
 * macOS/Windows run can never be mistaken for Ubuntu/glibc validation.
 */
describe('linux deployment baseline (V3-111)', () => {
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
