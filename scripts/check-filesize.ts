/**
 * File size gate — fails when a source file exceeds the line limit.
 *
 * Catches growing files before they become unmaintainable monsters.
 * Inspired by harness engineering "golden principles" — mechanical,
 * opinionated rules that keep the codebase legible for agents.
 *
 * Threshold: 500 lines for source files (app/, routes/, resources/,
 * migrations/, seeds/, server.ts). Scripts are exempt (generators
 * and linters are long by nature).
 *
 * Usage: npm run check:filesize
 * Exit codes: 0 = all files within limit, 1 = violations found
 */
import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..');
const LIMIT = 500;

// Directories to check — source code, not tooling.
const CHECK_DIRS = ['app', 'routes', 'resources', 'migrations', 'seeds'];
const CHECK_FILES = ['server.ts'];
const CHECK_EXT = new Set(['.ts', '.svelte']);

// Files explicitly exempt (documented reason per entry).
const WHITELIST = new Set<string>([
  // None currently — add here with a comment explaining why.
]);

interface Violation {
  file: string;
  lines: number;
  over: number;
}

function walk(dir: string, results: string[] = []): string[] {
  let entries: fs.Dirent[] = [];
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return results; }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === 'build' || entry.name === '__tests__') continue;
      walk(full, results);
    } else if (entry.isFile()) {
      if (CHECK_EXT.has(path.extname(entry.name))) results.push(full);
    }
  }
  return results;
}

function countLines(filePath: string): number {
  try {
    return fs.readFileSync(filePath, 'utf-8').split('\n').length;
  } catch {
    return 0;
  }
}

function main(): void {
  const files: string[] = [];
  for (const d of CHECK_DIRS) files.push(...walk(path.join(ROOT, d)));
  for (const f of CHECK_FILES) {
    const full = path.join(ROOT, f);
    if (fs.existsSync(full)) files.push(full);
  }

  const violations: Violation[] = [];
  for (const abs of files) {
    const rel = path.relative(ROOT, abs).replace(/\\/g, '/');
    if (WHITELIST.has(rel)) continue;
    const lines = countLines(abs);
    if (lines > LIMIT) {
      violations.push({ file: rel, lines, over: lines - LIMIT });
    }
  }

  if (violations.length === 0) {
    console.log(`✓ File size check passed — ${files.length} files scanned, all under ${LIMIT} lines.`);
    process.exit(0);
  }

  console.error(`✗ File size check failed — ${violations.length} file(s) exceed ${LIMIT} lines:\n`);
  for (const v of violations.sort((a, b) => b.lines - a.lines)) {
    console.error(`  ${v.file} — ${v.lines} lines (${v.over} over limit)`);
  }
  console.error(`\nFix: split the file, extract helpers, or add to WHITELIST in scripts/check-filesize.ts with a comment.`);
  process.exit(1);
}

main();
