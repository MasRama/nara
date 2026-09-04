/**
 * Human cold-start environment check (V3-134 fixture).
 *
 * Verifies the starting environment for an unfamiliar-developer session:
 * Node/npm versions, installed dependencies, built CLI, healthy
 * architecture. Exits non-zero naming the first problem. Creates nothing
 * and reveals nothing about the session tasks.
 */
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';

const projectRoot = process.cwd();
const failures = [];

const nodeMajor = Number(process.version.slice(1).split('.')[0]);
if (Number.isNaN(nodeMajor) || nodeMajor < 22) {
  failures.push(`Node.js 22+ required (found ${process.version}).`);
}

try {
  const npmVersion = execFileSync('npm', ['--version'], { encoding: 'utf8' }).trim();
  if (Number(npmVersion.split('.')[0]) < 10) {
    failures.push(`npm 10+ required (found ${npmVersion}).`);
  }
} catch {
  failures.push('npm is not on PATH.');
}

for (const required of ['node_modules', 'build/src/cli/index.js', 'build/server.js']) {
  if (!existsSync(`${projectRoot}/${required}`)) {
    failures.push(`Missing ${required}: run \`npm ci && npm run build\` first.`);
  }
}

if (failures.length === 0) {
  try {
    execFileSync('node', ['build/src/cli/index.js', 'doctor'], {
      cwd: projectRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (error) {
    failures.push(`Starting architecture is not healthy: ${error instanceof Error ? error.message : String(error)}`);
  }
}

if (failures.length > 0) {
  for (const failure of failures) console.error(`cold-start fixture: ${failure}`);
  process.exit(1);
}

console.log('cold-start fixture: environment ready.');
