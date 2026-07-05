/**
 * Security baseline gate — grep-based check for dangerous patterns.
 *
 * This is NOT a pentest. It is a baseline grep that catches obvious mistakes
 * that lint:layers does not cover. For full security testing, see
 * .agents/skills/pentest-pattern.md (OWASP Top 10 POCs).
 *
 * Rules:
 *   S1. No `{@html` in .svelte files — XSS vector (Svelte auto-escapes `{}`, only `{@html}` bypasses)
 *   S2. No `eval()` / `new Function()` in backend — code injection
 *   S3. No `child_process.exec` with template literals — command injection
 *   S4. No hardcoded secrets (password/secret/apiKey/token = "literal")
 *   S5. No `innerHTML` assignment in frontend — XSS
 *   S6. No `document.write` in frontend — XSS
 *   S7. No `dangerouslySetInnerHTML` (React pattern — banned, should not appear)
 *
 * Usage: npm run check:security
 * Exit codes: 0 = clean, 1 = violations found
 */
import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..');

const SKIP_DIRS = new Set([
  'node_modules', 'dist', 'build', '.git', 'storage', 'database',
  'logs', '.vscode', '.github', '.playwright-mcp', '.agents', 'scripts',
  'coverage', 'docs',
]);

interface Violation {
  rule: string;
  file: string;
  line: number;
  text: string;
  message: string;
}

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
      if (ext === '.ts' || ext === '.svelte' || ext === '.js') results.push(full);
    }
  }
  return results;
}

function checkFile(absPath: string): void {
  const rel = path.relative(ROOT, absPath).replace(/\\/g, '/');
  const ext = path.extname(absPath);
  const content = fs.readFileSync(absPath, 'utf-8');
  const lines = content.split('\n');

  const isFrontend = rel.startsWith('resources/') && ext === '.svelte';
  const isBackend = (rel.startsWith('app/') || rel.startsWith('server.ts')) && ext === '.ts';

  lines.forEach((line, idx) => {
    const lineNum = idx + 1;
    const trimmed = line.trim();

    // Skip comments
    if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) return;

    // S1: {@html in .svelte — XSS vector
    if (isFrontend && /\{@html\b/.test(line)) {
      violations.push({
        rule: 'S1', file: rel, line: lineNum, text: trimmed,
        message: '{@html} bypasses Svelte auto-escaping — XSS vector. Fix: render as text via {} or sanitize with DOMPurify first. See .agents/skills/pentest-pattern.md A03',
      });
    }

    // S2: eval() / new Function() in backend — code injection
    if (isBackend && (/\beval\s*\(/.test(line) || /new\s+Function\s*\(/.test(line))) {
      violations.push({
        rule: 'S2', file: rel, line: lineNum, text: trimmed,
        message: 'eval()/new Function() is code injection risk. Fix: avoid dynamic code execution. See .agents/skills/pentest-pattern.md A03',
      });
    }

    // S3: child_process.exec with template literals — command injection
    if (isBackend && /child_process/.test(line) && /exec\s*\(\s*`/.test(line)) {
      violations.push({
        rule: 'S3', file: rel, line: lineNum, text: trimmed,
        message: 'child_process.exec with template literal — command injection risk. Fix: use execFile with arg array, never shell with interpolated input. See .agents/skills/pentest-pattern.md A03',
      });
    }

    // S4: Hardcoded secrets — password/secret/apiKey/token = "literal"
    if (isBackend || isFrontend) {
      const secretMatch = line.match(/(?:password|passwd|secret|apiKey|api_key|token|privateKey)\s*[:=]\s*['"]([a-zA-Z0-9_\-]{8,})['"]/i);
      if (secretMatch && !/example|placeholder|test|dummy|sample|change.?me/i.test(secretMatch[1])) {
        violations.push({
          rule: 'S4', file: rel, line: lineNum, text: trimmed,
          message: 'Possible hardcoded secret. Fix: read from env via @config/env.ts. See .agents/skills/pentest-pattern.md A02',
        });
      }
    }

    // S5: innerHTML assignment in frontend — XSS
    if (isFrontend && /\.innerHTML\s*=/.test(line)) {
      violations.push({
        rule: 'S5', file: rel, line: lineNum, text: trimmed,
        message: 'innerHTML assignment — XSS risk. Fix: use Svelte {} interpolation (auto-escaped) or {@html} only with sanitized input. See .agents/skills/pentest-pattern.md A03',
      });
    }

    // S6: document.write in frontend — XSS
    if (isFrontend && /document\.write\s*\(/.test(line)) {
      violations.push({
        rule: 'S6', file: rel, line: lineNum, text: trimmed,
        message: 'document.write — XSS risk. Fix: use Svelte rendering. See .agents/skills/pentest-pattern.md A03',
      });
    }

    // S7: dangerouslySetInnerHTML — React pattern, banned in this codebase
    if (isFrontend && /dangerouslySetInnerHTML/.test(line)) {
      violations.push({
        rule: 'S7', file: rel, line: lineNum, text: trimmed,
        message: 'dangerouslySetInnerHTML is a React pattern — banned (ADR 0003). Fix: use Svelte {} or {@html} with sanitized input.',
      });
    }
  });
}

function main(): void {
  const files = walk(ROOT);
  for (const f of files) checkFile(f);

  if (violations.length === 0) {
    console.log(`✓ Security baseline check passed — ${files.length} files scanned, no dangerous patterns found.`);
    process.exit(0);
  }

  console.error(`✗ Security baseline check failed — ${violations.length} violation(s) found:\n`);

  const byRule = new Map<string, Violation[]>();
  for (const v of violations) {
    if (!byRule.has(v.rule)) byRule.set(v.rule, []);
    byRule.get(v.rule)!.push(v);
  }

  for (const [rule, vs] of Array.from(byRule.entries()).sort()) {
    console.error(`### ${rule} (${vs.length} violation${vs.length > 1 ? 's' : ''})`);
    for (const v of vs) {
      console.error(`  ${v.file}:${v.line}`);
      console.error(`    ${v.text}`);
      console.error(`    → ${v.message}`);
    }
    console.error('');
  }

  console.error('Note: this is a baseline grep, not a full pentest. For OWASP Top 10 POCs, see .agents/skills/pentest-pattern.md');
  process.exit(1);
}

main();
