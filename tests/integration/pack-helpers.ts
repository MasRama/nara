import { execFile } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const execFileAsync = promisify(execFile);

export const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const isWindows = process.platform === 'win32';

export interface CommandResult {
  stdout: string;
  stderr: string;
}

export function repoRoot(): string {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
}

export function publishablePackageDir(): string {
  return path.join(repoRoot(), 'packages', 'nara');
}

export async function runCommand(
  command: string,
  args: string[],
  cwd: string,
  env?: NodeJS.ProcessEnv,
): Promise<CommandResult> {
  try {
    const result = await execFileAsync(command, args, {
      cwd,
      env: { ...process.env, ...env },
      maxBuffer: 16 * 1024 * 1024,
    });
    return { stdout: result.stdout, stderr: result.stderr };
  } catch (error) {
    const failure = error as Error & { stdout?: string; stderr?: string; status?: number };
    const output = [failure.stdout, failure.stderr].filter(Boolean).join('\n');
    throw new Error(
      `${command} ${args.join(' ')} failed (exit ${String(failure.status ?? 'unknown')})${output ? `\n${output}` : ''}`,
    );
  }
}

let cachedTarball: string | undefined;

/**
 * Pack the publishable package exactly as npm would publish it and return
 * the tarball path. Pre-publish this is the stand-in for the npm registry:
 * generated projects pin `@nara-web/cli: <version>`, which only resolves from the
 * registry after the first publish. Tests rewrite that spec to
 * `file:<tarball>` (same bytes the registry would serve) and assert the
 * pinned spec before rewriting.
 */
export async function ensurePackedNara(): Promise<string> {
  if (cachedTarball && existsSync(cachedTarball)) return cachedTarball;
  const packageDir = publishablePackageDir();
  if (!existsSync(path.join(packageDir, 'dist', 'index.js'))) {
    throw new Error(
      'Missing packages/nara/dist/index.js. Run `npm run build && npm run stage:package` before the packaged-lifecycle tests so `npm pack` ships the real CLI.',
    );
  }
  const destination = mkdtempSync(path.join(os.tmpdir(), 'nara-pack-'));
  const { stdout } = await runCommand(npmCommand, ['pack', '--pack-destination', destination], packageDir);
  const fileName = stdout.trim().split('\n').at(-1)?.trim();
  if (!fileName) throw new Error('`npm pack` did not report a tarball filename');
  cachedTarball = path.join(destination, fileName);
  if (!existsSync(cachedTarball)) throw new Error(`Packed tarball not found at ${cachedTarball}`);
  return cachedTarball;
}

/** Pre-publish stand-in for the registry: point the pinned spec at the packed tarball. */
export function pointNaraAtTarball(projectDirectory: string, tarball: string): void {
  const manifestPath = path.join(projectDirectory, 'package.json');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
    devDependencies: Record<string, string>;
  };
  manifest.devDependencies['@nara-web/cli'] = `file:${tarball}`;
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
}

function localNaraEntrypoint(projectDirectory: string): { command: string; argsPrefix: string[] } {
  if (!isWindows) {
    return { command: path.join(projectDirectory, 'node_modules', '.bin', 'nara'), argsPrefix: [] };
  }
  return {
    command: 'node',
    argsPrefix: [path.join(projectDirectory, 'node_modules', '@nara-web', 'cli', 'dist', 'index.js')],
  };
}

/** Run the generated project's own installed Nara CLI (never the repo checkout). */
export async function runLocalNara(projectDirectory: string, args: string[]): Promise<CommandResult> {
  const entrypoint = localNaraEntrypoint(projectDirectory);
  return runCommand(entrypoint.command, [...entrypoint.argsPrefix, ...args], projectDirectory);
}

/** Run the generated project's own installed Nara CLI, expecting failure. */
export async function runLocalNaraExpectingFailure(
  projectDirectory: string,
  args: string[],
): Promise<CommandResult & { status: number }> {
  const entrypoint = localNaraEntrypoint(projectDirectory);
  try {
    await execFileAsync(entrypoint.command, [...entrypoint.argsPrefix, ...args], {
      cwd: projectDirectory,
      env: { ...process.env },
      maxBuffer: 16 * 1024 * 1024,
    });
  } catch (error) {
    const failure = error as Error & { stdout?: string; stderr?: string; status?: number };
    return { stdout: failure.stdout ?? '', stderr: failure.stderr ?? '', status: failure.status ?? 1 };
  }
  throw new Error(`local nara ${args.join(' ')} unexpectedly succeeded`);
}
