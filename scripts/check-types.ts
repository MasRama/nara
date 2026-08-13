/**
 * Type safety gate — blocks new `any`/`as any`/`@ts-ignore`/`@ts-expect-error`.
 *
 * AI agents overuse `any`. This gate prevents type erosion by tracking a
 * baseline of existing `any` instances. If a file's count increases, or a
 * new file contains `any`, the gate fails.
 *
 * The baseline is stored in `.agents/types-baseline.json` (file → count).
 * To update the baseline after intentional changes:
 *   npx ts-node scripts/check-types.ts --update
 *
 * Patterns detected:
 *   T1. `: any`       — explicit any type annotation
 *   T2. `as any`      — type assertion to any
 *   T3. `@ts-ignore`  — suppress type error
 *   T4. `@ts-expect-error` — suppress type error
 *   T5. `<any>`       — generic any
 *
 * Usage: npm run check:types
 * Exit codes: 0 = no new any, 1 = new any detected, 2 = baseline missing
 */
import * as fs from 'fs';
import * as path from 'path';
import { walk, DEFAULT_SKIP_DIRS } from './lib/walk';

const ROOT = path.resolve(__dirname, '..');
const BASELINE_FILE = path.join(ROOT, '.agents', 'types-baseline.json');

const SCAN_DIRS = ['app', 'resources', 'routes', 'migrations', 'seeds'];
const SCAN_FILES = ['server.ts'];

// Patterns that indicate `any` usage.
const ANY_PATTERNS = [
  /:\s*any\b/g,           // T1: : any
  /\bas\s+any\b/g,        // T2: as any
  /@ts-ignore/g,          // T3: @ts-ignore
  /@ts-expect-error/g,    // T4: @ts-expect-error
  /<any>/g,               // T5: <any>
];

interface Violation {
  file: string;
  baseline: number;
  current: number;
  newCount: number;
}

function countAny(content: string): number {
  let count = 0;
  for (const pattern of ANY_PATTERNS) {
    const matches = content.match(pattern);
    if (matches) count += matches.length;
  }
  return count;
}

function collectFiles(): string[] {
  const skipDirs = new Set([...DEFAULT_SKIP_DIRS, 'coverage', 'docs', 'tests']);
  const files: string[] = [];
  for (const dir of SCAN_DIRS) {
    files.push(...walk(path.join(ROOT, dir), { skipDirs }));
  }
  for (const f of SCAN_FILES) {
    const full = path.join(ROOT, f);
    if (fs.existsSync(full)) files.push(full);
  }
  return files;
}

function getCurrentCounts(): Map<string, number> {
  const counts = new Map<string, number>();
  const files = collectFiles();
  for (const file of files) {
    const rel = path.relative(ROOT, file).replace(/\\/g, '/');
    const content = fs.readFileSync(file, 'utf-8');
    const count = countAny(content);
    if (count > 0) counts.set(rel, count);
  }
  return counts;
}

function loadBaseline(): Map<string, number> {
  if (!fs.existsSync(BASELINE_FILE)) return new Map();
  const raw = fs.readFileSync(BASELINE_FILE, 'utf-8');
  const obj = JSON.parse(raw) as Record<string, number>;
  return new Map(Object.entries(obj));
}

function saveBaseline(counts: Map<string, number>): void {
  const obj: Record<string, number> = {};
  for (const [file, count] of [...counts.entries()].sort()) {
    obj[file] = count;
  }
  fs.writeFileSync(BASELINE_FILE, JSON.stringify(obj, null, 2) + '\n');
}

function main(): void {
  const update = process.argv.includes('--update');
  const current = getCurrentCounts();

  if (update) {
    saveBaseline(current);
    const total = [...current.values()].reduce((a, b) => a + b, 0);
    console.log(`✓ Types baseline updated: ${current.size} files, ${total} any instances.`);
    console.log(`  Baseline: .agents/types-baseline.json`);
    process.exit(0);
  }

  const baseline = loadBaseline();
  const violations: Violation[] = [];

  for (const [file, currentCount] of current) {
    const baselineCount = baseline.get(file) ?? 0;
    if (currentCount > baselineCount) {
      violations.push({
        file,
        baseline: baselineCount,
        current: currentCount,
        newCount: currentCount - baselineCount,
      });
    }
  }

  // Also check: files in baseline that no longer exist (stale baseline)
  const staleBaseline: string[] = [];
  for (const [file] of baseline) {
    if (!current.has(file)) {
      const full = path.join(ROOT, file);
      if (!fs.existsSync(full)) staleBaseline.push(file);
    }
  }

  if (violations.length === 0 && staleBaseline.length === 0) {
    const total = [...current.values()].reduce((a, b) => a + b, 0);
    console.log(`✓ Type safety gate passed — no new \`any\` detected (${current.size} files, ${total} baseline instances).`);
    process.exit(0);
  }

  if (violations.length > 0) {
    console.error(`✗ Type safety gate failed — new \`any\` detected in ${violations.length} file(s):\n`);
    for (const v of violations) {
      console.error(`  ${v.file}: ${v.current} (baseline: ${v.baseline}, +${v.newCount} new)`);
    }
    console.error(`\nFix: replace \`any\` with proper types, or update baseline if intentional:`);
    console.error(`  npx ts-node scripts/check-types.ts --update`);
  }

  if (staleBaseline.length > 0) {
    console.error(`\n✗ Stale baseline entries (files no longer exist):\n`);
    for (const f of staleBaseline) {
      console.error(`  ${f}`);
    }
    console.error(`\nUpdate baseline: npx ts-node scripts/check-types.ts --update`);
  }

  process.exit(1);
}

main();
