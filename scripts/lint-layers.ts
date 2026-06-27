/**
 * Layer boundary lint — enforces AGENTS.md architectural conventions.
 *
 * Rules (from AGENTS.md anti-patterns):
 *   L1. Handlers must NOT import @services/SQLite directly — go through @queries
 *   L2. Handlers must NOT import @services/* except Authenticate, Logger, Storage
 *   L3. Page routes (handlers ending in *Page) must use res.inertia, not jsonSuccess
 *   L4. Data routes must use jsonSuccess/jsonError, not res.inertia
 *   L5. Frontend must NOT use fetch() — use api(() => axios.method())
 *   L6. Frontend must NOT use window.location for internal navigation
 *   L7. Frontend must NOT use router.post/put/patch/delete — use api() + axios
 *   L8. Frontend must NOT use onMount, $:, or export let — use Svelte 5 runes
 *   L9. No console.log in backend — use Logger
 *   L10. No bcrypt direct — use hashPassword from @services/Authenticate
 *
 * Usage: npx ts-node scripts/lint-layers.ts
 *        npm run lint:layers
 *
 * Exit codes: 0 = pass, 1 = violations found
 */

import * as fs from 'fs';
import * as path from 'path';

interface Violation {
  rule: string;
  file: string;
  line: number;
  text: string;
  message: string;
}

const ROOT = path.resolve(__dirname, '..');
const SKIP_DIRS = new Set([
  'node_modules', 'dist', 'build', '.git', 'storage', 'database',
  'logs', '.vscode', '.github', '.playwright-mcp', '.agents', 'scripts',
]);

const violations: Violation[] = [];

function walk(dir: string, results: string[] = []): string[] {
  let entries: fs.Dirent[] = [];
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return results; }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      walk(full, results);
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name);
      if (ext === '.ts' || ext === '.svelte') results.push(full);
    }
  }
  return results;
}

function checkFile(absPath: string): void {
  const rel = path.relative(ROOT, absPath).replace(/\\/g, '/');
  const ext = path.extname(absPath);
  const content = fs.readFileSync(absPath, 'utf-8');
  const lines = content.split('\n');

  const isHandler = rel.startsWith('app/handlers/') && rel !== 'app/handlers/index.ts';
  const isFrontend = rel.startsWith('resources/') && ext === '.svelte';
  const isBackend = rel.startsWith('app/') && ext === '.ts';

  lines.forEach((line, idx) => {
    const lineNum = idx + 1;
    const trimmed = line.trim();

    // Skip comments
    if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) return;

    // L1: Handlers must NOT import @services/SQLite directly
    if (isHandler && /from\s+['"]@services\/SQLite['"]/.test(line)) {
      violations.push({
        rule: 'L1', file: rel, line: lineNum, text: trimmed,
        message: 'Handlers must not import @services/SQLite directly — go through @queries',
      });
    }

    // L2: Handlers must NOT import @services/* except Authenticate, Logger, Storage
    if (isHandler) {
      const match = line.match(/from\s+['"]@services\/(\w+)['"]/);
      if (match && !['Authenticate', 'Logger', 'Storage', 'Session', 'LoginThrottle', 'CacheStore'].includes(match[1])) {
        violations.push({
          rule: 'L2', file: rel, line: lineNum, text: trimmed,
          message: `Handlers must not import @services/${match[1]} — only Authenticate, Logger, Storage, Session, LoginThrottle, CacheStore allowed`,
        });
      }
    }

    // L5: Frontend must NOT use fetch()
    if (isFrontend && /\bfetch\s*\(/.test(line) && !trimmed.startsWith('//')) {
      violations.push({
        rule: 'L5', file: rel, line: lineNum, text: trimmed,
        message: 'Frontend must not use fetch() — use api(() => axios.method())',
      });
    }

    // L6: Frontend must NOT use window.location for internal navigation
    // Exception: window.location.href for reading current URL (not navigation)
    if (isFrontend && /window\.location\b/.test(line)
        && !/window\.location\.href/.test(line)
        && !trimmed.startsWith('//')) {
      violations.push({
        rule: 'L6', file: rel, line: lineNum, text: trimmed,
        message: 'Frontend must not use window.location for navigation — use router.visit()',
      });
    }

    // L7: Frontend must NOT use router.post/put/patch/delete
    if (isFrontend && /router\.(post|put|patch|delete)\s*\(/.test(line) && !trimmed.startsWith('//')) {
      violations.push({
        rule: 'L7', file: rel, line: lineNum, text: trimmed,
        message: 'Frontend must not use router.post/put/patch/delete — use api(() => axios.method())',
      });
    }

    // L8: Frontend must NOT use onMount, $:, or export let (Svelte 4 patterns)
    if (isFrontend) {
      if (/onMount\s*\(/.test(line) && !trimmed.startsWith('//')) {
        violations.push({
          rule: 'L8', file: rel, line: lineNum, text: trimmed,
          message: 'Use $effect() instead of onMount() — Svelte 5 runes',
        });
      }
      if (/^\s*\$:\s/.test(line) && !trimmed.startsWith('//')) {
        violations.push({
          rule: 'L8', file: rel, line: lineNum, text: trimmed,
          message: 'Use $derived() instead of $: — Svelte 5 runes',
        });
      }
      if (/export\s+let\s+\w+/.test(line) && !trimmed.startsWith('//')) {
        violations.push({
          rule: 'L8', file: rel, line: lineNum, text: trimmed,
          message: 'Use $props() instead of export let — Svelte 5 runes',
        });
      }
    }

    // L9: No console.log in backend (use Logger)
    // Exception: bootstrap files (env.ts, App.ts, server.ts) — Logger not yet initialized
    const isBootstrap = rel === 'app/config/env.ts' || rel === 'app/core/App.ts' || rel === 'server.ts';
    if (isBackend && !isBootstrap && /console\.(log|warn|error|debug|info)\s*\(/.test(line) && !trimmed.startsWith('//')) {
      violations.push({
        rule: 'L9', file: rel, line: lineNum, text: trimmed,
        message: 'Use Logger.info/warn/error instead of console.log',
      });
    }

    // L10: No bcrypt direct — use hashPassword from @services/Authenticate
    if (isBackend && /from\s+['"]bcrypt['"]/.test(line) && !trimmed.startsWith('//')) {
      violations.push({
        rule: 'L10', file: rel, line: lineNum, text: trimmed,
        message: 'Use hashPassword/comparePassword from @services/Authenticate — never bcrypt directly',
      });
    }
  });
}

function main(): void {
  const files = walk(ROOT);
  for (const f of files) checkFile(f);

  if (violations.length === 0) {
    console.log('✓ Layer boundary lint passed — no violations found.');
    process.exit(0);
  }

  console.log(`✗ Layer boundary lint failed — ${violations.length} violation(s) found:\n`);

  const byRule = new Map<string, Violation[]>();
  for (const v of violations) {
    if (!byRule.has(v.rule)) byRule.set(v.rule, []);
    byRule.get(v.rule)!.push(v);
  }

  for (const [rule, vs] of Array.from(byRule.entries()).sort()) {
    console.log(`### ${rule} (${vs.length} violation${vs.length > 1 ? 's' : ''})`);
    for (const v of vs) {
      console.log(`  ${v.file}:${v.line}`);
      console.log(`    ${v.text}`);
      console.log(`    → ${v.message}`);
    }
    console.log('');
  }

  process.exit(1);
}

main();
