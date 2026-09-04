import { spawn, type ChildProcess } from 'node:child_process';
import { createServer } from 'node:net';
import { cpSync, mkdtempSync, rmSync, symlinkSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { execFile } from 'node:child_process';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const execFileAsync = promisify(execFile);
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const projectRoot = process.cwd();

let isolationRoot = '';

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

function isPortFree(port: number): Promise<boolean> {
  const { promise, resolve } = Promise.withResolvers<boolean>();
  const probe = createServer();
  probe.once('error', () => resolve(false));
  probe.listen(port, '127.0.0.1', () => {
    probe.close(() => resolve(true));
  });
  return promise;
}

interface SpawnedProduction {
  child: ChildProcess;
  output: () => string;
}

function spawnProduction(command: string, args: string[], cwd: string, env: NodeJS.ProcessEnv): SpawnedProduction {
  let text = '';
  const child = spawn(command, args, {
    cwd,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout?.setEncoding('utf8');
  child.stderr?.setEncoding('utf8');
  child.stdout?.on('data', (chunk: string) => {
    text += chunk;
  });
  child.stderr?.on('data', (chunk: string) => {
    text += chunk;
  });
  return { child, output: () => text };
}

/**
 * Wait for the child to exit on its own. Failure-path tests must never leak
 * a server: on timeout the whole process tree is killed before surfacing.
 */
async function waitForExit(child: ChildProcess, milliseconds: number): Promise<number | null> {
  if (child.exitCode !== null) return child.exitCode;
  const { promise, resolve } = Promise.withResolvers<number | null>();
  const fallback = setTimeout(() => {
    try {
      child.kill('SIGKILL');
    } catch {
      // Already gone; exit event below resolves.
    }
    setTimeout(() => resolve(child.exitCode), 1_000).unref?.();
  }, milliseconds);
  fallback.unref?.();
  child.once('exit', (code) => {
    clearTimeout(fallback);
    resolve(code);
  });
  return promise;
}

function productionEnv(port: number, overrides: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv {
  return {
    ...process.env,
    NODE_ENV: 'production',
    PORT: String(port),
    APP_URL: `http://127.0.0.1:${port}`,
    DB_FILE: ':memory:',
    LOG_LEVEL: 'warn',
    LOG_PRETTY: 'false',
    ...overrides,
  };
}

beforeAll(async () => {
  // Failure gates must prove the current source state, never a stale build.
  await execFileAsync(npmCommand, ['run', 'build'], { cwd: projectRoot });
  isolationRoot = mkdtempSync(path.join(os.tmpdir(), 'nara-production-startup-'));
}, 180_000);

afterAll(() => {
  if (isolationRoot) rmSync(isolationRoot, { recursive: true, force: true });
});

/**
 * Production-startup failure regressions (V3-112 hardening).
 *
 * These spawn the real built production process (`npm start` =
 * `node build/server.js`) and prove startup wiring fails loudly instead of
 * serving a misconfigured application. This complements the config unit
 * tests, which only call `parseEnv()` without proving the built process
 * honors it, and `test:production-serving`, which covers only the happy
 * path. Every test guarantees its child is reaped and no listener remains.
 */
describe('production startup failures', () => {
  it('exits non-zero and names APP_URL when it is blank in production', async () => {
    // Blank exercises the same `required in production` guard as absent:
    // dotenv never overrides an explicitly set variable, so '' stays ''
    // regardless of local .env files, and parseEnv treats it as missing.
    const port = await findFreePort();
    const { child, output } = spawnProduction(npmCommand, ['start'], projectRoot, productionEnv(port, { APP_URL: '' }));
    const code = await waitForExit(child, 30_000);
    expect(code, output()).not.toBe(0);
    expect(code, output()).not.toBeNull();
    expect(output()).toContain('APP_URL');
    await expect(isPortFree(port)).resolves.toBe(true);
  });

  it('exits non-zero and names MAX_JSON_BODY_BYTES for an invalid production numeric', async () => {
    const port = await findFreePort();
    const { child, output } = spawnProduction(
      npmCommand,
      ['start'],
      projectRoot,
      productionEnv(port, { MAX_JSON_BODY_BYTES: '-1' }),
    );
    const code = await waitForExit(child, 30_000);
    expect(code, output()).not.toBe(0);
    expect(code, output()).not.toBeNull();
    expect(output()).toContain('MAX_JSON_BODY_BYTES');
    await expect(isPortFree(port)).resolves.toBe(true);
  });

  it('exits non-zero with a rebuild diagnostic when the frontend build is missing', async () => {
    // Isolated artifact arrangement: copy only the built server (plus the
    // compiled runtime it requires) into a temp directory and omit
    // build/client, so the active worktree is never modified. `npm start`
    // cannot run there (no package.json), so invoke the same binary it
    // runs — `node build/server.js` — with the temp dir as cwd.
    const stage = path.join(isolationRoot, 'missing-frontend');
    for (const entry of ['server.js', 'src', 'official-features']) {
      cpSync(path.join(projectRoot, 'build', entry), path.join(stage, 'build', entry), { recursive: true });
    }
    // The staged server is the same compiled output; it still resolves
    // third-party imports (hono, better-sqlite3, …) from the workspace
    // node_modules via a symlink. Only build/client is omitted.
    symlinkSync(path.join(projectRoot, 'node_modules'), path.join(stage, 'node_modules'), 'dir');
    const port = await findFreePort();
    const { child, output } = spawnProduction(
      process.execPath,
      [path.join('build', 'server.js')],
      stage,
      productionEnv(port),
    );
    const code = await waitForExit(child, 30_000);
    expect(code, output()).not.toBe(0);
    expect(code, output()).not.toBeNull();
    expect(output()).toMatch(/frontend build is (missing|unavailable)/i);
    expect(output()).toMatch(/npm run build/);
    await expect(isPortFree(port)).resolves.toBe(true);
  });
});
