import { spawn } from 'node:child_process';
import { rmSync } from 'node:fs';

const isWindows = process.platform === 'win32';

// Clear console cross-platform (ANSI works on Win10+; fallback to cls via cmd)
if (isWindows && !process.env.WT_SESSION && !process.env.TERM) {
  spawn('cmd', ['/c', 'cls'], { stdio: 'inherit' });
} else {
  process.stdout.write('\x1B[2J\x1B[3J\x1B[0f');
}

// Clean build artifacts (replaces `rm -rf dist build`)
for (const dir of ['dist', 'build']) {
  rmSync(dir, { recursive: true, force: true });
}

// Spawn a child, forwarding stdio. Returns the handle.
function start(cmd: string, args: string[], label: string, color: string) {
  const child = spawn(cmd, args, {
    stdio: 'inherit',
    shell: isWindows,
    env: { ...process.env, FORCE_COLOR: '1' },
  });
  child.on('exit', (code) => {
    console.log(`\x1b[${color}m[${label}] exited with code ${code}\x1b[0m`);
  });
  return child;
}

// Vite — start immediately
const vite = start('npx', ['vite'], 'vite', '36');

// Nodemon — delay 1s to let Vite bind first (replaces `sleep 1 && ...`)
setTimeout(() => {
  start('npx', ['nodemon', '--legacy-watch'], 'nodemon', '34');
}, 1000);

// Die together
process.on('SIGINT', () => {
  vite.kill('SIGINT');
  process.exit(0);
});
