import { spawn, type ChildProcess } from 'node:child_process';
import { rmSync } from 'node:fs';

const isWindows = process.platform === 'win32';
const children: ChildProcess[] = [];
let shuttingDown = false;
let shutdownPromise: Promise<void> | undefined;

if (isWindows && !process.env.WT_SESSION && !process.env.TERM) {
  spawn('cmd', ['/c', 'cls'], { stdio: 'inherit' });
} else {
  process.stdout.write('\x1B[2J\x1B[3J\x1B[0f');
}

for (const dir of ['dist', 'build']) {
  rmSync(dir, { recursive: true, force: true });
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function start(command: string, args: string[], label: string): ChildProcess {
  const child = spawn(command, args, {
    stdio: 'inherit',
    shell: isWindows,
    env: { ...process.env, FORCE_COLOR: '1' },
  });
  children.push(child);

  child.once('error', (error) => {
    if (shuttingDown) return;
    process.stderr.write(`[${label}] failed: ${error.message}\n`);
    void shutdown(1);
  });
  child.once('exit', (code, signal) => {
    if (shuttingDown) return;
    const reason = signal ? `signal ${signal}` : `code ${code ?? 'unknown'}`;
    process.stderr.write(`[${label}] exited unexpectedly (${reason})\n`);
    void shutdown(signal === 'SIGINT' || signal === 'SIGTERM' ? 0 : 1);
  });

  return child;
}

function shutdown(exitCode: number): Promise<void> {
  if (shutdownPromise) return shutdownPromise;
  shuttingDown = true;
  shutdownPromise = (async () => {
    for (const child of children) {
      if (child.exitCode === null) child.kill('SIGTERM');
    }
    await delay(1_000);
    for (const child of children) {
      if (child.exitCode === null) child.kill('SIGKILL');
    }
    process.exitCode = exitCode;
  })();
  return shutdownPromise;
}

process.once('SIGINT', () => {
  void shutdown(0);
});
process.once('SIGTERM', () => {
  void shutdown(0);
});

start('vite', [], 'vite');
start('nodemon', ['--legacy-watch'], 'hono');
