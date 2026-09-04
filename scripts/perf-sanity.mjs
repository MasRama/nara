/**
 * Nara v3 performance sanity (V3-115).
 *
 * Local sanity baseline only: detects gross practical regressions in
 * startup, HTTP dispatch, `nara doctor`, and architecture discovery.
 * This is NOT a benchmark and MUST NOT gate `npm test`: latency variance on
 * shared runners would make micro-assertions flaky. Thresholds below are
 * catastrophic-only tripwires, not performance goals.
 *
 * Usage: `npm run perf:sanity` (requires `npm run build` first).
 */
import { spawn, execFile } from 'node:child_process';
import { createServer } from 'node:net';
import { existsSync } from 'node:fs';
import os from 'node:os';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const projectRoot = process.cwd();

const STARTUP_SAMPLES = 5;
const HTTP_SAMPLES = 200;
const API_SAMPLES = 10;
const DOCTOR_SAMPLES = 3;

// Catastrophic-only tripwires (see header). Normal runs sit far below these.
const STARTUP_TIMEOUT_MS = 60_000;
const HTTP_P95_BUDGET_MS = 5_000;
const DOCTOR_TIMEOUT_MS = 300_000;

function stats(samples) {
  const sorted = [...samples].sort((a, b) => a - b);
  const sum = sorted.reduce((acc, value) => acc + value, 0);
  const percentile = (p) => sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)];
  return {
    count: sorted.length,
    min: Math.round(sorted[0] * 100) / 100,
    median: Math.round(percentile(50) * 100) / 100,
    p95: Math.round(percentile(95) * 100) / 100,
    max: Math.round(sorted[sorted.length - 1] * 100) / 100,
    mean: Math.round((sum / sorted.length) * 100) / 100,
  };
}

function findFreePort() {
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

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function startProductionServer(port) {
  const baseUrl = `http://127.0.0.1:${port}`;
  const child = spawn('node', ['build/server.js'], {
    cwd: projectRoot,
    env: {
      ...process.env,
      NODE_ENV: 'production',
      PORT: String(port),
      APP_URL: baseUrl,
      DB_FILE: ':memory:',
      LOG_LEVEL: 'warn',
      LOG_PRETTY: 'false',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  return { child, baseUrl };
}

async function waitForHealth(baseUrl, child, output) {
  const deadline = Date.now() + STARTUP_TIMEOUT_MS;
  for (;;) {
    if (child.exitCode !== null) {
      throw new Error(`Production server exited with code ${child.exitCode}.\n${output.text}`);
    }
    try {
      const response = await fetch(`${baseUrl}/health`);
      if (response.status === 200) return;
    } catch {
      // Still binding.
    }
    if (Date.now() > deadline) {
      throw new Error(`Production server did not answer ${baseUrl}/health within ${STARTUP_TIMEOUT_MS}ms.`);
    }
    await delay(50);
  }
}

function stopServer(child) {
  return new Promise((resolve) => {
    if (!child || child.exitCode !== null) return resolve();
    const done = () => resolve();
    child.once('exit', done);
    child.kill('SIGTERM');
    setTimeout(done, 5000);
  });
}

async function measureStartup() {
  const samples = [];
  // Warmup: first spawn pays filesystem and JIT costs no user repeats.
  for (let run = -1; run < STARTUP_SAMPLES; run += 1) {
    const port = await findFreePort();
    const { child, baseUrl } = startProductionServer(port);
    const output = { text: '' };
    child.stdout?.on('data', (chunk) => {
      output.text += chunk;
    });
    child.stderr?.on('data', (chunk) => {
      output.text += chunk;
    });
    const started = performance.now();
    try {
      await waitForHealth(baseUrl, child, output);
      const elapsed = performance.now() - started;
      if (run >= 0) samples.push(elapsed);
    } finally {
      await stopServer(child);
    }
  }
  return stats(samples);
}

async function measureHttp() {
  const port = await findFreePort();
  const { child, baseUrl } = startProductionServer(port);
  const output = { text: '' };
  child.stdout?.on('data', (chunk) => {
    output.text += chunk;
  });
  child.stderr?.on('data', (chunk) => {
    output.text += chunk;
  });
  try {
    await waitForHealth(baseUrl, child, output);
    // /health is exempt from rate limiting, so this measures dispatch rather
    // than the limiter. /api/* is rate-limited: keep that sample small.
    const transport = [];
    for (let i = 0; i < HTTP_SAMPLES; i += 1) {
      const started = performance.now();
      const response = await fetch(`${baseUrl}/health`);
      await response.text();
      if (response.status !== 200) throw new Error(`GET /health returned ${response.status}`);
      transport.push(performance.now() - started);
    }
    const api = [];
    for (let i = 0; i < API_SAMPLES; i += 1) {
      const started = performance.now();
      const response = await fetch(`${baseUrl}/api/auth/me`);
      await response.text();
      if (response.status !== 401) throw new Error(`GET /api/auth/me returned ${response.status}`);
      api.push(performance.now() - started);
    }
    return { transport: stats(transport), api: stats(api) };
  } finally {
    await stopServer(child);
  }
}

async function measureDoctor() {
  const samples = [];
  for (let i = 0; i < DOCTOR_SAMPLES; i += 1) {
    const started = performance.now();
    await execFileAsync(
      npmCommand,
      ['exec', '--no', '--', 'ts-node', '-r', 'tsconfig-paths/register', 'src/cli/index.ts', 'doctor'],
      { cwd: projectRoot, timeout: DOCTOR_TIMEOUT_MS },
    );
    samples.push(performance.now() - started);
  }
  return stats(samples);
}

async function measureDiscovery() {
  // One ts-node process runs repeated discovery iterations so the numbers
  // reflect the engine, not interpreter startup (doctor covers process time).
  const probe = `
const { discoverFeatures } = require('./src/cli/architecture/discover-features.ts');
const { discoverFeatureDependencies } = require('./src/cli/architecture/discover-dependencies.ts');
const time = (fn: (root?: string) => unknown, n: number) => {
  const samples: number[] = [];
  for (let i = 0; i < n; i += 1) {
    const started = performance.now();
    fn(process.cwd());
    samples.push(performance.now() - started);
  }
  samples.sort((a, b) => a - b);
  const pct = (p: number) => samples[Math.min(samples.length - 1, Math.ceil((p / 100) * samples.length) - 1)];
  return { count: samples.length, min: samples[0], median: pct(50), p95: pct(95), max: samples[samples.length - 1] };
};
console.log(JSON.stringify({
  features: time(discoverFeatures, 20),
  dependencies: time(discoverFeatureDependencies, 20),
}));
`;
  const { stdout } = await execFileAsync(
    npmCommand,
    ['exec', '--no', '--', 'ts-node', '-r', 'tsconfig-paths/register', '-e', probe],
    { cwd: projectRoot, timeout: DOCTOR_TIMEOUT_MS, maxBuffer: 4 * 1024 * 1024 },
  );
  const parsed = JSON.parse(stdout.trim().slice(stdout.trim().lastIndexOf('\n') + 1));
  const round = (s) => Object.fromEntries(Object.entries(s).map(([k, v]) => [k, Math.round(v * 100) / 100]));
  return { features: round(parsed.features), dependencies: round(parsed.dependencies) };
}

function line(label, s, unit = 'ms') {
  console.log(
    `${label.padEnd(28)} n=${String(s.count).padEnd(4)} min=${s.min}${unit} median=${s.median}${unit} p95=${s.p95 ?? '-'}${s.p95 !== undefined ? unit : ''} max=${s.max}${unit}`,
  );
}

async function main() {
  if (!existsSync(`${projectRoot}/build/server.js`)) {
    console.error('perf:sanity requires a production build first: run `npm run build`.');
    process.exit(1);
  }
  let head = 'unknown';
  try {
    head = (await execFileAsync('git', ['rev-parse', '--short', 'HEAD'], { cwd: projectRoot })).stdout.trim();
  } catch {
    // Source tree without git metadata still yields usable numbers.
  }
  console.log('Nara v3 performance sanity (local baseline, not a benchmark)');
  console.log(
    `date=${new Date().toISOString()} commit=${head} node=${process.version} os=${os.platform()}/${os.arch()} cpus=${os.cpus().length} mem=${Math.round(os.totalmem() / 1024 ** 3)}GiB`,
  );
  console.log('---');

  const startup = await measureStartup();
  line('startup (built /health)', startup);
  const http = await measureHttp();
  line('http GET /health', http.transport);
  line('http GET /api/auth/me', http.api);
  const doctor = await measureDoctor();
  line('nara doctor (real CLI)', doctor);
  const discovery = await measureDiscovery();
  line('feature discovery', discovery.features);
  line('dependency discovery', discovery.dependencies);

  const failures = [];
  if (startup.max > STARTUP_TIMEOUT_MS) failures.push('startup exceeded catastrophic timeout');
  if (http.transport.p95 > HTTP_P95_BUDGET_MS) failures.push('HTTP p95 exceeded catastrophic budget');
  if (http.api.p95 > HTTP_P95_BUDGET_MS) failures.push('API p95 exceeded catastrophic budget');
  if (failures.length > 0) {
    console.error(`\nPERF REGRESSION: ${failures.join('; ')}`);
    process.exit(1);
  }
  console.log('\nNo practical regression: all sanity measurements within catastrophic-only budgets.');
}

await main();
