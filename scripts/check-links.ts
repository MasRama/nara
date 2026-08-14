/**
 * Markdown link checker — verifies internal links in docs resolve.
 *
 * Scans .md files for `[text](path)` links and verifies the target exists.
 * Catches broken relative links (e.g. after file renames or moves).
 *
 * Scope: root AGENTS.md, README.md, all nested AGENTS.md, all skills/*.md,
 * and docs/decisions/*.md. Skips external http(s) links and anchor-only links.
 *
 * Usage: npm run check:links
 * Exit codes: 0 = all links resolve, 1 = broken links found
 */
import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..');

const SCAN_FILES = [
  'AGENTS.md',
  'README.md',
  ...collectNestedAgents(),
  ...collectSkills(),
  ...collectAdrs(),
];

const LINK_RE = /\[([^\]]*)\]\(([^)]+)\)/g;
const HTTP_RE = /^https?:\/\//i;
const ANCHOR_RE = /^#/;
const MAILTO_RE = /^mailto:/i;

interface BrokenLink {
  file: string;
  line: number;
  link: string;
  target: string;
}

function collectNestedAgents(): string[] {
  const out: string[] = [];
  const dirs = [
    'app/core', 'app/handlers', 'app/middlewares', 'app/queries', 'app/services',
    'migrations', 'resources', 'resources/Components', 'resources/Pages',
    'resources/types', 'tests',
  ];
  for (const d of dirs) {
    const p = path.join(ROOT, d, 'AGENTS.md');
    if (fs.existsSync(p)) out.push(`${d}/AGENTS.md`);
  }
  return out;
}

function collectSkills(): string[] {
  const dir = path.join(ROOT, '.agents', 'skills');
  let entries: fs.Dirent[] = [];
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return []; }
  return entries
    .filter(e => e.isFile() && e.name.endsWith('.md'))
    .map(e => `.agents/skills/${e.name}`);
}

function collectAdrs(): string[] {
  const dir = path.join(ROOT, 'docs', 'decisions');
  let entries: fs.Dirent[] = [];
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return []; }
  return entries
    .filter(e => e.isFile() && e.name.endsWith('.md'))
    .map(e => `docs/decisions/${e.name}`);
}

function checkFile(rel: string): BrokenLink[] {
  const abs = path.join(ROOT, rel);
  const content = fs.readFileSync(abs, 'utf-8');
  const lines = content.split('\n');
  const broken: BrokenLink[] = [];
  const baseDir = path.dirname(rel);

  for (let i = 0; i < lines.length; i++) {
    let match: RegExpExecArray | null;
    LINK_RE.lastIndex = 0;
    while ((match = LINK_RE.exec(lines[i])) !== null) {
      const target = match[2].trim();
      // Skip external, anchor-only, mailto
      if (HTTP_RE.test(target) || ANCHOR_RE.test(target) || MAILTO_RE.test(target)) continue;
      // Strip anchor from target
      const [pathPart] = target.split('#');
      const resolved = path.normalize(path.join(baseDir, pathPart));
      const absTarget = path.join(ROOT, resolved);
      if (!fs.existsSync(absTarget)) {
        broken.push({ file: rel, line: i + 1, link: match[0], target: resolved });
      }
    }
  }
  return broken;
}

function main(): void {
  const all: BrokenLink[] = [];
  for (const f of SCAN_FILES) {
    const abs = path.join(ROOT, f);
    if (!fs.existsSync(abs)) continue;
    all.push(...checkFile(f));
  }

  if (all.length === 0) {
    console.log(`✓ Markdown link check passed — ${SCAN_FILES.length} files scanned, all links resolve.`);
    process.exit(0);
  }

  console.error(`✗ Markdown link check failed — ${all.length} broken link(s):\n`);
  const byFile = new Map<string, BrokenLink[]>();
  for (const b of all) {
    if (!byFile.has(b.file)) byFile.set(b.file, []);
    byFile.get(b.file)!.push(b);
  }
  for (const [file, links] of byFile) {
    console.error(`  ${file}:`);
    for (const l of links) {
      console.error(`    line ${l.line}: ${l.link} → ${l.target} (missing)`);
    }
    console.error('');
  }
  process.exit(1);
}

main();
