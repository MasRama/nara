// @vitest-environment node
import { spawn, type ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:net';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/**
 * Real single-server development smoke: Vite owns the only HTTP listener,
 * serves Vue browser routes itself, and mounts the Hono application only for
 * backend/reserved paths on that same origin.
 */
const projectRoot = process.cwd();

let viteProcess: ChildProcess | undefined;
let viteOutput = '';
let viteUrl = '';

function findFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = createServer();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const address = probe.address();
      probe.close(() => {
        if (address && typeof address === 'object') resolve(address.port);
        else reject(new Error('Could not allocate a free port'));
      });
    });
  });
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function waitForVite(): Promise<void> {
  if (!viteProcess) throw new Error('Vite was not started');
  const deadline = Date.now() + 90_000;
  for (;;) {
    if (viteProcess.exitCode !== null) {
      throw new Error(`Vite exited with code ${viteProcess.exitCode}.\n${viteOutput}`);
    }
    try {
      const response = await fetch(`${viteUrl}/health`);
      if (response.status === 200) return;
    } catch {
      // Vite may still be starting.
    }
    if (Date.now() > deadline) {
      throw new Error(`Vite did not serve ${viteUrl}/health within 90 seconds.\n${viteOutput}`);
    }
    await delay(250);
  }
}

beforeAll(async () => {
  const port = await findFreePort();
  viteUrl = `http://127.0.0.1:${port}`;
  const viteBinary = path.join(projectRoot, 'node_modules', '.bin', process.platform === 'win32' ? 'vite.cmd' : 'vite');
  viteProcess = spawn(viteBinary, ['--host', '127.0.0.1'], {
    cwd: projectRoot,
    env: { ...process.env, NODE_ENV: 'development', PORT: String(port) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  viteProcess.stdout?.setEncoding('utf8');
  viteProcess.stderr?.setEncoding('utf8');
  viteProcess.stdout?.on('data', (chunk: string) => {
    viteOutput += chunk;
  });
  viteProcess.stderr?.on('data', (chunk: string) => {
    viteOutput += chunk;
  });
  await waitForVite();
}, 120_000);

afterAll(async () => {
  if (viteProcess && viteProcess.exitCode === null) {
    viteProcess.kill('SIGTERM');
    await Promise.race([once(viteProcess, 'exit').catch(() => undefined), delay(5_000)]);
  }
  viteProcess = undefined;
});

describe('real single-server Vite topology', () => {
  it('serves the Vue document from Vite for / and a browser route', async () => {
    for (const pathname of ['/', '/login']) {
      const response = await fetch(`${viteUrl}${pathname}`);
      expect(response.status, pathname).toBe(200);
      expect(response.headers.get('content-type'), pathname).toContain('text/html');
      expect(await response.text(), pathname).toContain('<div id="app"></div>');
    }
  });

  it('serves /health from Hono on the same Vite listener', async () => {
    const response = await fetch(`${viteUrl}/health`);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ status: 'ok' });
  });

  it('serves a representative /api request from Hono on the same origin', async () => {
    const response = await fetch(`${viteUrl}/api/auth/me`);
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({ code: 'UNAUTHORIZED' });
  });
});
