/**
 * CODEMAP.md generator — produces a token-efficient codebase index for AI agents.
 *
 * Reads the repo, extracts:
 *   - directory tree (depth-limited)
 *   - public exports per file (functions, interfaces, types, consts)
 *   - import graph (file → imported modules)
 *   - entry points (server.ts, app.ts)
 *
 * Output: CODEMAP.md at repo root (~750-1500 tokens, depending on codebase size).
 *
 * Usage: npx ts-node -r tsconfig-paths/register scripts/codemap.ts
 *        npm run codemap
 */

import * as fs from 'fs';
import * as path from 'path';

interface FileEntry {
  path: string;
  lines: number;
  exports: ExportEntry[];
  imports: string[];
  isEntry: boolean;
}

interface ExportEntry {
  name: string;
  kind: 'function' | 'interface' | 'type' | 'const' | 'class';
}

const ROOT = path.resolve(__dirname, '..');
const OUTPUT = path.join(ROOT, 'CODEMAP.md');

const SKIP_DIRS = new Set([
  'node_modules', 'dist', 'build', '.git', 'storage', 'database',
  'logs', '.vscode', '.github', '.playwright-mcp', '.agents',
]);

const INDEX_EXT = new Set(['.ts', '.svelte']);

const ENTRY_FILES = new Set([
  'server.ts',
  'resources/app.ts',
  'routes/web.ts',
  'app/core/index.ts',
]);

function walk(dir: string, results: string[] = []): string[] {
  let entries: fs.Dirent[] = [];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return results;
  }

  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      walk(full, results);
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name);
      if (INDEX_EXT.has(ext)) results.push(full);
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

function extractExports(content: string, ext: string): ExportEntry[] {
  const exports: ExportEntry[] = [];
  const seen = new Set<string>();

  if (ext === '.svelte') {
    const scriptMatch = content.match(/<script[^>]*>([\s\S]*?)<\/script>/);
    if (!scriptMatch) return exports;
    content = scriptMatch[1];
  }

  const patterns: Array<[RegExp, ExportEntry['kind']]> = [
    [/export\s+const\s+(\w+)/g, 'const'],
    [/export\s+function\s+(\w+)/g, 'function'],
    [/export\s+async\s+function\s+(\w+)/g, 'function'],
    [/export\s+interface\s+(\w+)/g, 'interface'],
    [/export\s+type\s+(\w+)/g, 'type'],
    [/export\s+class\s+(\w+)/g, 'class'],
    [/export\s+default\s+function\s+(\w+)/g, 'function'],
  ];

  for (const [regex, kind] of patterns) {
    let match: RegExpExecArray | null;
    regex.lastIndex = 0;
    while ((match = regex.exec(content)) !== null) {
      const name = match[1];
      const key = `${kind}:${name}`;
      if (!seen.has(key)) {
        seen.add(key);
        exports.push({ name, kind });
      }
    }
  }

  return exports;
}

function extractImports(content: string, ext: string): string[] {
  if (ext === '.svelte') {
    const scriptMatch = content.match(/<script[^>]*>([\s\S]*?)<\/script>/);
    if (!scriptMatch) return [];
    content = scriptMatch[1];
  }

  const imports = new Set<string>();
  const patterns = [
    /import\s+.*?\s+from\s+['"]([^'"]+)['"]/g,
    /import\s+['"]([^'"]+)['"]/g,
  ];

  for (const regex of patterns) {
    let match: RegExpExecArray | null;
    regex.lastIndex = 0;
    while ((match = regex.exec(content)) !== null) {
      imports.add(match[1]);
    }
  }

  return Array.from(imports).sort();
}

function formatTree(entries: FileEntry[]): string {
  const byDir = new Map<string, FileEntry[]>();
  for (const e of entries) {
    const dir = path.dirname(e.path);
    if (!byDir.has(dir)) byDir.set(dir, []);
    byDir.get(dir)!.push(e);
  }

  const lines: string[] = [];
  for (const dir of Array.from(byDir.keys()).sort()) {
    const files = byDir.get(dir)!.sort((a, b) => a.path.localeCompare(b.path));
    const dirLabel = dir === '.' ? './' : `${dir}/`;
    lines.push(`### ${dirLabel}`);
    lines.push('');

    for (const f of files) {
      const name = path.basename(f.path);
      const star = f.isEntry ? ' ★' : '';
      const exp = f.exports.length > 0
        ? ` — ${f.exports.map(e => e.name).slice(0, 8).join(', ')}${f.exports.length > 8 ? `, +${f.exports.length - 8}` : ''}`
        : '';
      lines.push(`- \`${name}\`${star} (${f.lines}L)${exp}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

function formatPublicApi(entries: FileEntry[]): string {
  const lines: string[] = [];
  for (const f of entries.filter(e => e.exports.length > 0)) {
    lines.push(`### \`${f.path}\``);
    lines.push('');
    for (const e of f.exports) {
      const icon = { function: 'fn', const: 'const', interface: 'iface', type: 'type', class: 'class' }[e.kind];
      lines.push(`- \`${icon}\` **${e.name}**`);
    }
    lines.push('');
  }
  return lines.join('\n');
}

function formatImportGraph(entries: FileEntry[]): string {
  const lines: string[] = [];
  for (const f of entries.filter((e: FileEntry) => e.imports.length > 0)) {
    const internal = f.imports.filter((i: string) => i.startsWith('@') || i.startsWith('.') || i.startsWith('/'));
    if (internal.length === 0) continue;
    lines.push(`- \`${f.path}\` → ${internal.map((i: string) => `\`${i}\``).join(', ')}`);
  }
  return lines.join('\n');
}

function main(): void {
  const files = walk(ROOT).sort();
  const entries: FileEntry[] = [];

  for (const absPath of files) {
    const rel = path.relative(ROOT, absPath).replace(/\\/g, '/');
    const ext = path.extname(absPath);
    if (!INDEX_EXT.has(ext)) continue;

    const content = fs.readFileSync(absPath, 'utf-8');
    entries.push({
      path: rel,
      lines: content.split('\n').length,
      exports: extractExports(content, ext),
      imports: extractImports(content, ext),
      isEntry: ENTRY_FILES.has(rel),
    });
  }

  entries.sort((a, b) => a.path.localeCompare(b.path));

  const totalLines = entries.reduce((s, e) => s + e.lines, 0);
  const totalExports = entries.reduce((s, e) => s + e.exports.length, 0);

  const md = `# CODEMAP.md

> Auto-generated by \`npm run codemap\`. Do not edit manually.
> Regenerate after large changes: \`npm run codemap\`.
> Read this BEFORE searching the codebase — it gives topology in one read.

## Stats

- Files indexed: ${entries.length}
- Total lines: ${totalLines}
- Total exports: ${totalExports}
- Entry points (★): ${entries.filter(e => e.isEntry).map(e => `\`${e.path}\``).join(', ')}

## File Tree

${formatTree(entries)}

## Public API Index

${formatPublicApi(entries)}

## Internal Import Graph

${formatImportGraph(entries) || '_(no internal imports)_'}
`;

  fs.writeFileSync(OUTPUT, md);
  console.log(`CODEMAP.md generated: ${OUTPUT}`);
  console.log(`  ${entries.length} files, ${totalLines} lines, ${totalExports} exports`);
}

main();
