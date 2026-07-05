/**
 * Freshness gate — detects stale auto-generated docs.
 *
 * Compares mtime of CODEMAP.md against all source files it indexes.
 * If any source file is newer than CODEMAP.md -> stale -> exit 1.
 *
 * Run via `npm run check:freshness`.
 * Exit codes: 0 = fresh, 1 = stale, 2 = CODEMAP.md missing.
 */
import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..');
const CODEMAP = path.join(ROOT, 'CODEMAP.md');

const TRACKED_DIRS = ['app', 'routes', 'resources', 'migrations', 'seeds'];
const TRACKED_EXT = new Set(['.ts', '.svelte']);

function walk(dir: string, out: string[] = []): string[] {
  let entries: fs.Dirent[] = [];
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of entries) {
    if (e.name === 'node_modules' || e.name === 'dist' || e.name === 'build' || e.name === '__tests__') continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, out);
    else if (TRACKED_EXT.has(path.extname(e.name))) out.push(full);
  }
  return out;
}

function main(): void {
  if (!fs.existsSync(CODEMAP)) {
    console.error('✗ CODEMAP.md missing. Run `npm run codemap`.');
    process.exit(2);
  }

  const codemapMtime = fs.statSync(CODEMAP).mtimeMs;
  const sources: string[] = [];
  for (const d of TRACKED_DIRS) sources.push(...walk(path.join(ROOT, d)));
  sources.push(path.join(ROOT, 'server.ts'));

  const stale: string[] = [];
  for (const f of sources) {
    if (fs.statSync(f).mtimeMs > codemapMtime) {
      stale.push(path.relative(ROOT, f));
    }
  }

  if (stale.length === 0) {
    console.log(`✓ CODEMAP.md fresh — ${sources.length} source files checked.`);
    process.exit(0);
  }

  console.error(`✗ CODEMAP.md stale — ${stale.length} source file(s) newer than CODEMAP.md:`);
  for (const f of stale.sort()) console.error(`  ${f}`);
  console.error('\nRegenerate: npm run codemap');
  process.exit(1);
}

main();
