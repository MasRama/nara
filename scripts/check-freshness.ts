/**
 * Freshness gate — checks if AGENTS.md files are stale relative to code changes.
 *
 * Rule: if code in a directory changes, the AGENTS.md for that directory
 * (or its parent) should also be updated. Advisory — exits 0 by default,
 * use --strict to fail CI.
 *
 * Mappings (code dir → AGENTS.md that documents it):
 *   app/handlers/*      → app/handlers/AGENTS.md (none yet) OR app/AGENTS.md
 *   app/queries/*       → app/AGENTS.md
 *   app/services/*      → app/AGENTS.md
 *   app/middlewares/*   → app/AGENTS.md
 *   app/core/*          → app/AGENTS.md
 *   app/types/*         → app/AGENTS.md
 *   app/validators/*    → app/AGENTS.md
 *   app/config/*        → app/AGENTS.md
 *   routes/*            → routes/AGENTS.md
 *   migrations/*        → migrations/AGENTS.md
 *   seeds/*             → database/AGENTS.md
 *   resources/Pages/*   → resources/Pages/AGENTS.md
 *   resources/Components/* → resources/Components/AGENTS.md
 *   resources/lib/*     → resources/AGENTS.md
 *   resources/types/*   → resources/types/AGENTS.md
 *   tests/*             → tests/AGENTS.md
 *
 * Usage:
 *   npx ts-node scripts/check-freshness.ts           # advisory (exit 0)
 *   npx ts-node scripts/check-freshness.ts --strict   # fail on stale (exit 1)
 *   npm run check:freshness
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..');
const STRICT = process.argv.includes('--strict');

// Map: code path prefix → AGENTS.md file that documents it
const FRESHNESS_MAP: Array<{ prefix: string; agentsFile: string }> = [
  { prefix: 'app/handlers/', agentsFile: 'app/AGENTS.md' },
  { prefix: 'app/queries/', agentsFile: 'app/AGENTS.md' },
  { prefix: 'app/services/', agentsFile: 'app/AGENTS.md' },
  { prefix: 'app/middlewares/', agentsFile: 'app/AGENTS.md' },
  { prefix: 'app/core/', agentsFile: 'app/AGENTS.md' },
  { prefix: 'app/types/', agentsFile: 'app/AGENTS.md' },
  { prefix: 'app/validators/', agentsFile: 'app/AGENTS.md' },
  { prefix: 'app/config/', agentsFile: 'app/AGENTS.md' },
  { prefix: 'routes/', agentsFile: 'routes/AGENTS.md' },
  { prefix: 'migrations/', agentsFile: 'migrations/AGENTS.md' },
  { prefix: 'seeds/', agentsFile: 'database/AGENTS.md' },
  { prefix: 'resources/Pages/', agentsFile: 'resources/Pages/AGENTS.md' },
  { prefix: 'resources/Components/', agentsFile: 'resources/Components/AGENTS.md' },
  { prefix: 'resources/lib/', agentsFile: 'resources/AGENTS.md' },
  { prefix: 'resources/types/', agentsFile: 'resources/types/AGENTS.md' },
  { prefix: 'tests/', agentsFile: 'tests/AGENTS.md' },
];

interface StaleEntry {
  codeFile: string;
  agentsFile: string;
}

function getStagedFiles(): string[] {
  try {
    const output = execSync('git diff --cached --name-only', { cwd: ROOT, encoding: 'utf-8' });
    return output.trim().split('\n').filter(Boolean);
  } catch {
    return [];
  }
}

function getModifiedFiles(): string[] {
  try {
    const output = execSync('git diff --name-only HEAD', { cwd: ROOT, encoding: 'utf-8' });
    return output.trim().split('\n').filter(Boolean);
  } catch {
    return [];
  }
}

function findAgentsFile(codePath: string): string | null {
  for (const { prefix, agentsFile } of FRESHNESS_MAP) {
    if (codePath.startsWith(prefix)) return agentsFile;
  }
  return null;
}

function main(): void {
  // Use staged files if any, else modified files (for local checks)
  let files = getStagedFiles();
  if (files.length === 0) files = getModifiedFiles();

  if (files.length === 0) {
    console.log('✓ Freshness gate: no changes to check.');
    process.exit(0);
  }

  // Filter to code files only (skip AGENTS.md, CODEMAP.md, docs, configs)
  const codeFiles = files.filter(f => {
    if (f.endsWith('AGENTS.md')) return false;
    if (f.endsWith('CODEMAP.md')) return false;
    if (f.startsWith('.agents/')) return false;
    if (f.startsWith('docs/')) return false;
    if (f.endsWith('.md') && !f.includes('AGENTS')) return false;
    const ext = path.extname(f);
    return ['.ts', '.svelte', '.js', '.css'].includes(ext);
  });

  // Find AGENTS.md files that should have been updated
  const stale: StaleEntry[] = [];
  const updatedAgents = new Set(files.filter(f => f.endsWith('AGENTS.md')));

  for (const codeFile of codeFiles) {
    const agentsFile = findAgentsFile(codeFile);
    if (agentsFile && !updatedAgents.has(agentsFile)) {
      stale.push({ codeFile, agentsFile });
    }
  }

  if (stale.length === 0) {
    console.log('✓ Freshness gate: all AGENTS.md files are up to date.');
    process.exit(0);
  }

  // Group by agentsFile
  const byAgents = new Map<string, string[]>();
  for (const s of stale) {
    if (!byAgents.has(s.agentsFile)) byAgents.set(s.agentsFile, []);
    byAgents.get(s.agentsFile)!.push(s.codeFile);
  }

  console.log(`⚠ Freshness gate: ${byAgents.size} AGENTS.md file(s) may be stale.\n`);
  console.log('Code changed but AGENTS.md not updated:\n');

  for (const [agentsFile, codeFiles] of Array.from(byAgents.entries()).sort()) {
    console.log(`  ${agentsFile}`);
    for (const cf of codeFiles.slice(0, 5)) {
      console.log(`    ← ${cf}`);
    }
    if (codeFiles.length > 5) {
      console.log(`    ... and ${codeFiles.length - 5} more`);
    }
    console.log('');
  }

  console.log('To fix: review the changes and update the AGENTS.md file if conventions changed.');
  console.log('If no update is needed, continue — this is advisory.\n');

  if (STRICT) {
    console.log('❌ Freshness gate failed in strict mode.');
    process.exit(1);
  } else {
    console.log('ℹ Advisory mode — exiting 0. Use --strict to fail CI.');
    process.exit(0);
  }
}

main();
