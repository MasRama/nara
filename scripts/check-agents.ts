/**
 * AGENTS.md accuracy gate — detects stale nested AGENTS.md files.
 *
 * For each nested AGENTS.md, parses the "Structure" table and verifies that
 * every filename mentioned in backticks actually exists in that directory,
 * and that every source file in the directory is mentioned in the table.
 *
 * Run via `npm run check:agents`.
 * Exit codes: 0 = accurate, 1 = stale/missing entries, 2 = AGENTS.md missing.
 */
import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..');

interface Check {
  agentsFile: string;
  dir: string;
  ext: string[];
}

// Directories with an AGENTS.md whose "Structure" table lists source files.
const CHECKS: Check[] = [
  { agentsFile: 'app/core/AGENTS.md', dir: 'app/core', ext: ['.ts'] },
  { agentsFile: 'app/handlers/AGENTS.md', dir: 'app/handlers', ext: ['.ts'] },
  { agentsFile: 'app/middlewares/AGENTS.md', dir: 'app/middlewares', ext: ['.ts'] },
  { agentsFile: 'app/queries/AGENTS.md', dir: 'app/queries', ext: ['.ts'] },
  { agentsFile: 'app/services/AGENTS.md', dir: 'app/services', ext: ['.ts'] },
  { agentsFile: 'resources/Components/AGENTS.md', dir: 'resources/Components', ext: ['.svelte'] },
  { agentsFile: 'resources/Pages/AGENTS.md', dir: 'resources/Pages', ext: ['.svelte'] },
  { agentsFile: 'resources/types/AGENTS.md', dir: 'resources/types', ext: ['.ts'] },
];

interface Violation {
  agentsFile: string;
  kind: 'missing-file' | 'unlisted-file';
  file: string;
  message: string;
}

function extractMentionedFiles(content: string): Set<string> {
  // Only parse rows of a markdown table whose first cell is a filename in backticks.
  // Matches lines like: | `users.ts` | description... |
  // This avoids false positives from inline code mentions in prose.
  const matches = content.matchAll(/^\|\s*`([a-zA-Z0-9_\-\/]+\.\w+)`\s*\|/gm);
  const set = new Set<string>();
  for (const m of matches) {
    set.add(m[1]);
  }
  return set;
}

function listDirFiles(dir: string, exts: string[]): string[] {
  const full = path.join(ROOT, dir);
  let entries: fs.Dirent[] = [];
  try { entries = fs.readdirSync(full, { withFileTypes: true }); } catch { return []; }
  return entries
    .filter(e => e.isFile() && exts.includes(path.extname(e.name)))
    .map(e => e.name);
}

function checkOne(c: Check): Violation[] {
  const violations: Violation[] = [];
  const agentsPath = path.join(ROOT, c.agentsFile);

  if (!fs.existsSync(agentsPath)) {
    violations.push({
      agentsFile: c.agentsFile, kind: 'missing-file', file: '',
      message: `${c.agentsFile} is missing — expected to exist.`,
    });
    return violations;
  }

  const content = fs.readFileSync(agentsPath, 'utf-8');
  const mentioned = extractMentionedFiles(content);
  const actual = new Set(listDirFiles(c.dir, c.ext));

  // Files mentioned in AGENTS.md but missing from disk
  for (const f of mentioned) {
    // Skip nested paths like "auth/login.svelte" — only check top-level names
    if (f.includes('/')) continue;
    if (!actual.has(f)) {
      violations.push({
        agentsFile: c.agentsFile, kind: 'missing-file', file: f,
        message: `${c.agentsFile} mentions \`${f}\` but it does not exist in ${c.dir}/.`,
      });
    }
  }

  // Files on disk but not mentioned in AGENTS.md (excluding index.ts which is implicit)
  for (const f of actual) {
    if (f === 'index.ts') continue;
    if (!mentioned.has(f)) {
      violations.push({
        agentsFile: c.agentsFile, kind: 'unlisted-file', file: f,
        message: `${c.dir}/${f} exists but is not listed in ${c.agentsFile} Structure table.`,
      });
    }
  }

  return violations;
}

function main(): void {
  const all: Violation[] = [];
  for (const c of CHECKS) all.push(...checkOne(c));

  if (all.length === 0) {
    console.log(`✓ AGENTS.md accuracy check passed — ${CHECKS.length} files verified.`);
    process.exit(0);
  }

  console.error(`✗ AGENTS.md accuracy check failed — ${all.length} issue(s):\n`);
  for (const v of all) {
    console.error(`  ${v.agentsFile}`);
    console.error(`    ${v.message}`);
    console.error('');
  }
  console.error('Fix: update the Structure table in the AGENTS.md file(s) above.');
  process.exit(1);
}

main();
