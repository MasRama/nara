import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export type EvolutionFileAction =
  | 'unchanged'
  | 'keep-local'
  | 'add'
  | 'update'
  | 'remove'
  | 'merge'
  | 'conflict';

export interface ReconciledFile {
  path: string;
  action: EvolutionFileAction;
  reason: string;
  content?: Buffer;
}

export interface FeatureReconciliation {
  files: ReconciledFile[];
  conflicts: string[];
  candidate: Map<string, Buffer>;
}

function comparePaths(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function optionalBytesEqual(left: Buffer | undefined, right: Buffer | undefined): boolean {
  if (left === undefined || right === undefined) return left === right;
  return left.equals(right);
}

function isTextFile(bytes: Buffer): boolean {
  if (bytes.includes(0)) return false;
  return Buffer.from(bytes.toString('utf8'), 'utf8').equals(bytes);
}

function mergeTextFiles(local: Buffer, base: Buffer, incoming: Buffer): { content?: Buffer; conflict: boolean } {
  const directory = mkdtempSync(path.join(os.tmpdir(), 'nara-merge-'));
  const localPath = path.join(directory, 'local');
  const basePath = path.join(directory, 'base');
  const incomingPath = path.join(directory, 'incoming');
  try {
    writeFileSync(localPath, local);
    writeFileSync(basePath, base);
    writeFileSync(incomingPath, incoming);
    try {
      return {
        content: execFileSync('git', ['merge-file', '-p', '--diff3', localPath, basePath, incomingPath], {
          stdio: ['ignore', 'pipe', 'pipe'],
          maxBuffer: 64 * 1024 * 1024,
        }),
        conflict: false,
      };
    } catch (error) {
      const failure = error as { status?: number; stdout?: Buffer | string; stderr?: Buffer | string };
      if (failure.status === 1) return { conflict: true };
      const details = failure.stderr === undefined ? '' : `: ${String(failure.stderr).trim()}`;
      throw new Error(`git merge-file failed${details}`);
    }
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

/** Reconcile three Feature source maps without writing any project files. */
export function reconcileFeatureFiles(
  base: ReadonlyMap<string, Buffer>,
  local: ReadonlyMap<string, Buffer>,
  incoming: ReadonlyMap<string, Buffer>,
): FeatureReconciliation {
  const paths = new Set<string>();
  for (const relativePath of base.keys()) paths.add(relativePath);
  for (const relativePath of local.keys()) paths.add(relativePath);
  for (const relativePath of incoming.keys()) paths.add(relativePath);

  const candidate = new Map<string, Buffer>();
  for (const [relativePath, bytes] of local) candidate.set(relativePath, bytes);
  const files: ReconciledFile[] = [];
  const conflicts: string[] = [];

  for (const relativePath of [...paths].sort(comparePaths)) {
    const baseBytes = base.get(relativePath);
    const localBytes = local.get(relativePath);
    const incomingBytes = incoming.get(relativePath);

    if (baseBytes === undefined) {
      if (localBytes === undefined && incomingBytes !== undefined) {
        candidate.set(relativePath, incomingBytes);
        files.push({ path: relativePath, action: 'add', reason: 'file was added by the official source', content: incomingBytes });
      } else if (localBytes !== undefined && incomingBytes === undefined) {
        files.push({ path: relativePath, action: 'keep-local', reason: 'file was added locally', content: localBytes });
      } else if (localBytes !== undefined && incomingBytes !== undefined && optionalBytesEqual(localBytes, incomingBytes)) {
        candidate.set(relativePath, localBytes);
        files.push({ path: relativePath, action: 'unchanged', reason: 'local and incoming additions are identical', content: localBytes });
      } else if (localBytes !== undefined && incomingBytes !== undefined) {
        conflicts.push(relativePath);
        files.push({ path: relativePath, action: 'conflict', reason: 'local and incoming added different files', content: localBytes });
      }
      continue;
    }

    const localMatchesBase = optionalBytesEqual(localBytes, baseBytes);
    const incomingMatchesBase = optionalBytesEqual(incomingBytes, baseBytes);
    if (localMatchesBase && incomingMatchesBase) {
      if (localBytes === undefined) candidate.delete(relativePath);
      else candidate.set(relativePath, localBytes);
      files.push({ path: relativePath, action: 'unchanged', reason: 'base, local, and incoming are identical', content: localBytes });
      continue;
    }
    if (localMatchesBase) {
      if (incomingBytes === undefined) {
        candidate.delete(relativePath);
        files.push({ path: relativePath, action: 'remove', reason: 'the unchanged local file was deleted upstream' });
      } else {
        candidate.set(relativePath, incomingBytes);
        files.push({ path: relativePath, action: 'update', reason: 'the local file was unchanged and upstream changed it', content: incomingBytes });
      }
      continue;
    }
    if (incomingMatchesBase) {
      files.push({
        path: relativePath,
        action: 'keep-local',
        reason: localBytes === undefined ? 'the local deletion is preserved' : 'only the local file changed',
        content: localBytes,
      });
      continue;
    }
    if (optionalBytesEqual(localBytes, incomingBytes)) {
      if (localBytes === undefined) candidate.delete(relativePath);
      else candidate.set(relativePath, localBytes);
      files.push({ path: relativePath, action: 'unchanged', reason: 'local and incoming share the same result', content: localBytes });
      continue;
    }
    if (localBytes === undefined || incomingBytes === undefined) {
      conflicts.push(relativePath);
      files.push({ path: relativePath, action: 'conflict', reason: 'local and upstream changed the file in incompatible deletion states' });
      continue;
    }
    if (!isTextFile(baseBytes) || !isTextFile(localBytes) || !isTextFile(incomingBytes)) {
      conflicts.push(relativePath);
      files.push({ path: relativePath, action: 'conflict', reason: 'binary file changed independently on both sides', content: localBytes });
      continue;
    }

    const merged = mergeTextFiles(localBytes, baseBytes, incomingBytes);
    if (merged.conflict || merged.content === undefined) {
      conflicts.push(relativePath);
      files.push({ path: relativePath, action: 'conflict', reason: 'text changes overlap and could not be merged', content: localBytes });
    } else {
      candidate.set(relativePath, merged.content);
      files.push({ path: relativePath, action: 'merge', reason: 'non-overlapping text changes merged cleanly', content: merged.content });
    }
  }

  return { files, conflicts, candidate };
}

export function writeFeatureMap(files: ReadonlyMap<string, Buffer>, directory: string): void {
  mkdirSync(directory, { recursive: true });
  for (const relativePath of [...files.keys()].sort(comparePaths)) {
    const bytes = files.get(relativePath);
    if (bytes === undefined) throw new Error(`Missing reconciled Feature bytes for ${relativePath}.`);
    const targetPath = path.join(directory, ...relativePath.split('/'));
    mkdirSync(path.dirname(targetPath), { recursive: true });
    writeFileSync(targetPath, bytes);
  }
}
