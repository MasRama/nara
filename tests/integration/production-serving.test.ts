import { execFile, spawn, type ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const execFileAsync = promisify(execFile);
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const projectRoot = process.cwd();

let server: ChildProcess | undefined;
let serverOutput = '';
let baseUrl = '';

async function runBuild(): Promise<void> {
  await execFileAsync(npmCommand, ['run', 'build'], {
    cwd: projectRoot,
    env: { ...process.env },
    maxBuffer: 16 * 1024 * 1024,
  });
}

function findFreePort(): Promise<number> {
  const { promise, resolve, reject } = Promise.withResolvers<number>();
  const listener = createServer();
  listener.once('error', reject);
  listener.listen(0, '127.0.0.1', () => {
    const address = listener.address();
    if (!address || typeof address === 'string') {
      listener.close();
      reject(new Error('Could not determine a free TCP port'));
      return;
    }
    listener.close((error) => {
      if (error) reject(error);
      else resolve(address.port);
    });
  });
  return promise;
}

function startProductionServer(port: number): void {
  baseUrl = `http://127.0.0.1:${port}`;
  server = spawn(npmCommand, ['start'], {
    cwd: projectRoot,
    env: {
      ...process.env,
      NODE_ENV: 'production',
      PORT: String(port),
      APP_URL: baseUrl,
      DB_FILE: ':memory:',
      LOG_LEVEL: 'info',
      LOG_PRETTY: 'false',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  server.stdout?.setEncoding('utf8');
  server.stderr?.setEncoding('utf8');
  server.stdout?.on('data', (chunk: string) => {
    serverOutput += chunk;
  });
  server.stderr?.on('data', (chunk: string) => {
    serverOutput += chunk;
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

async function get(pathname: string): Promise<Response> {
  return fetch(`${baseUrl}${pathname}`);
}

beforeAll(async () => {
  await runBuild();
  const port = await findFreePort();
  startProductionServer(port);
  await waitForServer();
});

afterAll(async () => {
  await stopProductionServer();
});

describe('production browser and static delivery', () => {
  it('uses one deterministic client artifact root', () => {
    expect(existsSync(path.join(projectRoot, 'build', 'client', 'index.html'))).toBe(true);
    expect(existsSync(path.join(projectRoot, 'build', 'client', 'assets'))).toBe(true);
    expect(existsSync(path.join(projectRoot, 'build', 'dist'))).toBe(false);
    expect(existsSync(path.join(projectRoot, 'build', 'public'))).toBe(false);
    expect(existsSync(path.join(projectRoot, 'dist'))).toBe(false);
  });

  it('serves the SPA shell for every shipped browser route and unknown browser paths', async () => {
    for (const pathname of ['/', '/login', '/register', '/dashboard', '/profile', '/users', '/roles', '/this-route-does-not-exist']) {
      const response = await get(pathname);
      expect(response.status, pathname).toBe(200);
      expect(response.headers.get('content-type'), pathname).toContain('text/html');
      expect(await response.text(), pathname).toContain('<div id="app"></div>');
      expect(response.headers.get('cache-control'), pathname).toBe('no-cache');
    }
  });

  it('serves hashed assets and public assets with bounded cache policies', async () => {
    const assetFiles = readdirSync(path.join(projectRoot, 'build', 'client', 'assets'));
    const javascript = assetFiles.find((file) => file.endsWith('.js'));
    const stylesheet = assetFiles.find((file) => file.endsWith('.css'));
    if (!javascript || !stylesheet) throw new Error('The production build did not emit JS and CSS assets');

    const javascriptResponse = await get(`/assets/${javascript}`);
    expect(javascriptResponse.status).toBe(200);
    expect(javascriptResponse.headers.get('content-type')).toContain('javascript');
    expect(javascriptResponse.headers.get('cache-control')).toBe('public, max-age=31536000, immutable');

    const stylesheetResponse = await get(`/assets/${stylesheet}`);
    expect(stylesheetResponse.status).toBe(200);
    expect(stylesheetResponse.headers.get('content-type')).toContain('text/css');
    expect(stylesheetResponse.headers.get('cache-control')).toBe('public, max-age=31536000, immutable');

    const publicResponse = await get('/nara.png');
    expect(publicResponse.status).toBe(200);
    expect(publicResponse.headers.get('content-type')).toContain('image/png');
    expect(publicResponse.headers.get('cache-control')).toBe('public, max-age=3600');
  });

  it('returns 404 for missing assets and traversal attempts without serving HTML or source files', async () => {
    for (const pathname of [
      '/assets/does-not-exist.js',
      '/landing/does-not-exist.webp',
      '/assets/%2e%2e/server.js',
      '/assets//etc/passwd',
      '/assets/%5C..%5Cserver.js',
      '/server.js',
    ]) {
      const response = await get(pathname);
      expect(response.status, pathname).toBe(404);
      expect(response.headers.get('content-type'), pathname).not.toContain('text/html');
      expect(response.headers.get('cache-control'), pathname).toBe('no-store');
      expect(await response.text(), pathname).not.toContain('startServer');
    }
  });

  it('preserves backend and API-miss behavior on the same Node process', async () => {
    const healthResponse = await get('/health');
    expect(healthResponse.status).toBe(200);
    await expect(healthResponse.json()).resolves.toEqual({ status: 'ok' });

    const readyResponse = await get('/ready');
    expect(readyResponse.status).toBe(200);
    await expect(readyResponse.json()).resolves.toEqual({ status: 'ok' });

    const authResponse = await get('/api/auth/me');
    expect(authResponse.status).toBe(401);
    await expect(authResponse.json()).resolves.toMatchObject({ code: 'UNAUTHORIZED' });

    const missingApiResponse = await get('/api/does-not-exist');
    expect(missingApiResponse.status).toBe(404);
    expect(missingApiResponse.headers.get('content-type')).not.toContain('text/html');
    expect(await missingApiResponse.text()).not.toContain('<div id="app"></div>');
  });

  it('logs the public browser URL at production startup', () => {
    expect(serverOutput).toContain(`Browser/API: ${baseUrl}`);
  });

  it('returns production security headers from the real production process', async () => {
    for (const pathname of ['/', '/api/auth/me']) {
      const response = await get(pathname);
      expect(response.headers.get('Content-Security-Policy'), pathname).toContain(`default-src 'self'`);
      expect(response.headers.get('X-Content-Type-Options'), pathname).toBe('nosniff');
      expect(response.headers.get('Strict-Transport-Security'), pathname).toBe(
        'max-age=31536000; includeSubDomains',
      );
    }
  });
});
