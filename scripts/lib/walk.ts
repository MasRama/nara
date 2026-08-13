/**
 * Shared file traversal for gate scripts.
 *
 * Every check script used to re-implement the same recursive walk with
 * slightly drifted skip sets. This is the single source of truth.
 */
import * as fs from 'fs';
import * as path from 'path';

export const DEFAULT_SKIP_DIRS = new Set([
  'node_modules', 'dist', 'build', '.git', 'storage', 'database',
  'logs', '.vscode', '.github', '.playwright-mcp', '.agents', 'scripts',
]);

export interface WalkOptions {
  skipDirs?: Set<string>;
  extensions?: Set<string>;
}

export function walk(dir: string, options: WalkOptions = {}): string[] {
  const skipDirs = options.skipDirs ?? DEFAULT_SKIP_DIRS;
  const extensions = options.extensions ?? new Set(['.ts', '.svelte']);
  const results: string[] = [];

  let entries: fs.Dirent[] = [];
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return results; }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (skipDirs.has(entry.name)) continue;
      results.push(...walk(full, options));
    } else if (entry.isFile() && extensions.has(path.extname(entry.name))) {
      results.push(full);
    }
  }
  return results;
}
