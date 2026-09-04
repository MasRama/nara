import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export class DiffGitError extends Error {}

/** Resolve the enclosing Git repository root or throw an actionable error. */
export function gitRepoRoot(cwd = process.cwd()): string {
  try {
    const root = execFileSync('git', ['rev-parse', '--show-toplevel'], {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
    if (!root) throw new Error('empty result');
    return root;
  } catch {
    throw new DiffGitError(
      `Not inside a Git repository (working directory: ${cwd}). Run nara diff from a Git checkout.`,
    );
  }
}

/** Verify a Git ref resolves to a commit; return the commit SHA. */
export function verifyGitRef(ref: string, cwd = process.cwd()): string {
  try {
    return execFileSync('git', ['rev-parse', '--verify', `${ref}^{commit}`], {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
  } catch {
    throw new DiffGitError(
      `Unknown Git ref "${ref}". Verify the ref exists with: git rev-parse --verify ${ref}`,
    );
  }
}

function listRefBlobs(ref: string, cwd: string): Array<{ path: string }> {
  let output: Buffer;
  try {
    output = execFileSync('git', ['ls-tree', '-r', '-z', ref], { cwd, stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (error) {
    throw new DiffGitError(
      `Unreadable repository state for ref "${ref}": ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  const entries: Array<{ path: string }> = [];
  for (const line of output.toString('utf8').split('\0')) {
    if (!line) continue;
    // Format: "<mode> <type> <sha>\t<path>"
    const tab = line.indexOf('\t');
    if (tab < 0) continue;
    const meta = line.slice(0, tab).split(' ');
    const filePath = line.slice(tab + 1);
    if (meta[1] !== 'blob') continue;
    if (!filePath || path.isAbsolute(filePath) || filePath.split('/').includes('..')) continue;
    entries.push({ path: filePath });
  }
  return entries;
}

/**
 * Materialize a Git ref into an isolated temporary directory using only
 * read-only plumbing (`ls-tree`, `show`). Never touches the working tree.
 * The caller MUST remove the returned directory (see `removeTempDir`).
 */
export function materializeRef(ref: string, cwd = process.cwd()): string {
  verifyGitRef(ref, cwd);
  const directory = mkdtempSync(path.join(os.tmpdir(), 'nara-diff-'));
  try {
    for (const entry of listRefBlobs(ref, cwd)) {
      let content: Buffer;
      try {
        content = execFileSync('git', ['show', `${ref}:${entry.path}`], {
          cwd,
          stdio: ['ignore', 'pipe', 'pipe'],
          maxBuffer: 64 * 1024 * 1024,
        });
      } catch (error) {
        throw new DiffGitError(
          `Unreadable repository state for ref "${ref}" at path "${entry.path}": ${error instanceof Error ? error.message : String(error)}`,
        );
      }
      const destination = path.resolve(directory, entry.path);
      if (destination !== directory && !destination.startsWith(`${directory}${path.sep}`)) continue;
      mkdirSync(path.dirname(destination), { recursive: true });
      writeFileSync(destination, content);
    }
    // Marker proves the snapshot came from a ref, not the working tree.
    if (!existsSync(directory)) {
      throw new DiffGitError(`Unreadable repository state for ref "${ref}": materialization produced no directory.`);
    }
    return directory;
  } catch (error) {
    rmSync(directory, { recursive: true, force: true });
    throw error;
  }
}

export function removeTempDir(directory: string): void {
  rmSync(directory, { recursive: true, force: true });
}
