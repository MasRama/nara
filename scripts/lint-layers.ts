/**
 * Layer boundary lint — enforces AGENTS.md architectural conventions.
 *
 * Rules (from AGENTS.md anti-patterns + naming conventions):
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
 *   L11. Handler exports must NOT use generic REST names (index, store, create, etc.)
 *   L12. Handler exports should include resource name (createUser, not just create)
 *   L13. No vague function names (handle, process, run, do, execute as standalone)
 *   L14. Queries must NOT import from handlers, validators, middlewares, core
 *   L15. Services must NOT import from handlers, queries, validators, middlewares
 *   L16. Validators must NOT import from handlers, queries, services, middlewares, core
 *   L17. Middlewares must NOT import from handlers, validators
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
  const isQuery = rel.startsWith('app/queries/') && rel !== 'app/queries/index.ts';
  const isService = rel.startsWith('app/services/') && rel !== 'app/services/index.ts';
  const isMiddleware = rel.startsWith('app/middlewares/') && rel !== 'app/middlewares/index.ts';
  const isValidator = rel.startsWith('app/validators/') && rel !== 'app/validators/index.ts';

  lines.forEach((line, idx) => {
    const lineNum = idx + 1;
    const trimmed = line.trim();

    // Skip comments
    if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) return;

    // L1: Handlers must NOT import @services/SQLite directly
    if (isHandler && /from\s+['"]@services\/SQLite['"]/.test(line)) {
      violations.push({
        rule: 'L1', file: rel, line: lineNum, text: trimmed,
        message: 'Handlers must not import @services/SQLite directly. Fix: import query functions from @queries instead. See .agents/skills/sqlite-usage.md',
      });
    }

    // L2: Handlers must NOT import @services/* except Authenticate, Logger, Storage
    if (isHandler) {
      const match = line.match(/from\s+['"]@services\/(\w+)['"]/);
      if (match && !['Authenticate', 'Logger', 'Storage', 'Session', 'LoginThrottle', 'CacheStore'].includes(match[1])) {
        violations.push({
          rule: 'L2', file: rel, line: lineNum, text: trimmed,
          message: `Handlers must not import @services/${match[1]}. Fix: only Authenticate, Logger, Storage, Session, LoginThrottle, CacheStore are allowed. See .agents/skills/crud-pattern.md`,
        });
      }
    }

    // L5: Frontend must NOT use fetch()
    if (isFrontend && /\bfetch\s*\(/.test(line) && !trimmed.startsWith('//')) {
      violations.push({
        rule: 'L5', file: rel, line: lineNum, text: trimmed,
        message: 'Frontend must not use fetch(). Fix: use api(() => axios.get/post/put/delete(...)). See .agents/skills/inertia-patterns.md',
      });
    }

    // L6: Frontend must NOT use window.location for internal navigation
    // Exception: window.location.href for reading current URL (not navigation)
    if (isFrontend && /window\.location\b/.test(line)
        && !/window\.location\.href/.test(line)
        && !trimmed.startsWith('//')) {
      violations.push({
        rule: 'L6', file: rel, line: lineNum, text: trimmed,
        message: 'Frontend must not use window.location for navigation. Fix: use router.visit("/path"). See .agents/skills/inertia-patterns.md',
      });
    }

    // L7: Frontend must NOT use router.post/put/patch/delete
    if (isFrontend && /router\.(post|put|patch|delete)\s*\(/.test(line) && !trimmed.startsWith('//')) {
      violations.push({
        rule: 'L7', file: rel, line: lineNum, text: trimmed,
        message: 'Frontend must not use router.post/put/patch/delete — bypasses api() wrapper (no toast/CSRF). Fix: use api(() => axios.method()). See .agents/skills/inertia-patterns.md',
      });
    }

    // L8: Frontend must NOT use onMount, $:, or export let (Svelte 4 patterns)
    if (isFrontend) {
      if (/onMount\s*\(/.test(line) && !trimmed.startsWith('//')) {
        violations.push({
          rule: 'L8', file: rel, line: lineNum, text: trimmed,
          message: 'Use $effect() instead of onMount() — Svelte 5 runes. See .agents/skills/inertia-patterns.md',
        });
      }
      if (/^\s*\$:\s/.test(line) && !trimmed.startsWith('//')) {
        violations.push({
          rule: 'L8', file: rel, line: lineNum, text: trimmed,
          message: 'Use $derived() instead of $: — Svelte 5 runes. See .agents/skills/inertia-patterns.md',
        });
      }
      if (/export\s+let\s+\w+/.test(line) && !trimmed.startsWith('//')) {
        violations.push({
          rule: 'L8', file: rel, line: lineNum, text: trimmed,
          message: 'Use $props() instead of export let — Svelte 5 runes. See .agents/skills/inertia-patterns.md',
        });
      }
    }

    // L9: No console.log in backend (use Logger)
    // Exception: bootstrap files (env.ts, App.ts, server.ts) — Logger not yet initialized
    const isBootstrap = rel === 'app/config/env.ts' || rel === 'app/core/App.ts' || rel === 'server.ts';
    if (isBackend && !isBootstrap && /console\.(log|warn|error|debug|info)\s*\(/.test(line) && !trimmed.startsWith('//')) {
      violations.push({
        rule: 'L9', file: rel, line: lineNum, text: trimmed,
        message: 'Use Logger.info/warn/error instead of console.log. Fix: import Logger from @services/Logger. See AGENTS.md anti-pattern #6',
      });
    }

    // L10: No bcrypt direct — use hashPassword from @services/Authenticate
    if (isBackend && /from\s+['"]bcrypt['"]/.test(line) && !trimmed.startsWith('//')) {
      violations.push({
        rule: 'L10', file: rel, line: lineNum, text: trimmed,
        message: 'Use hashPassword/comparePassword from @services/Authenticate — never bcrypt directly. See .agents/skills/auth-rbac.md',
      });
    }

    // L11: Handler exports must not use generic REST names (index, show, store, create, update, destroy, remove)
    // These require context to understand — AI must read the file to know what `index` does.
    // Use descriptive names: listUsers, addUser, editUser, removeUsers, landingPage, etc.
    if (isHandler) {
      const match = line.match(/^export\s+const\s+(index|show|store|create|update|destroy|remove|handle|process|run|do|execute)\b/);
      if (match) {
        violations.push({
          rule: 'L11', file: rel, line: lineNum, text: trimmed,
          message: `Handler export "${match[1]}" is too generic. Fix: use descriptive name (e.g. listUsers, addUser, editUser, removeUsers). See .agents/skills/crud-pattern.md and docs/decisions/0009-descriptive-handler-names.md`,
        });
      }
    }

    // L12: Handler exports should include the resource name (e.g. createUser, not just create)
    // Exception: page handlers ending in "Page" (landingPage, usersPage), middleware (avatarMiddleware),
    //            and utility handlers (logout, changePassword, changeProfile, serveDistAsset, etc.)
    if (isHandler) {
      const match = line.match(/^export\s+const\s+(\w+)\s*=/);
      if (match) {
        const name = match[1];
        const isPage = name.endsWith('Page');
        const isMiddleware = name.endsWith('Middleware');
        const isKnownUtility = ['logout', 'changePassword', 'changeProfile', 'submitLogin', 'submitRegister',
          'loginPage', 'registerPage', 'permissionsData', 'uploadAsset', 'serveDistAsset',
          'servePublicAsset', 'googleRedirect', 'googleCallback', 'removeUsers', 'addUser', 'editUser',
          'addRole', 'editRole', 'removeRole'].includes(name);
        // Check for verb-only names that should include resource (e.g. "create" without "User")
        const genericVerbs = ['create', 'update', 'delete', 'remove', 'list', 'get', 'find', 'save', 'edit', 'add'];
        if (genericVerbs.includes(name) && !isPage && !isMiddleware && !isKnownUtility) {
          violations.push({
            rule: 'L12', file: rel, line: lineNum, text: trimmed,
            message: `Handler export "${name}" should include the resource name. Fix: use ${name}User, ${name}Role, ${name}Product, etc. See .agents/skills/crud-pattern.md`,
          });
        }
      }
    }

    // L13: No banned vague function names anywhere in backend (handle, process, run, do, execute as standalone)
    // These tell the AI nothing about what the function does
    if (isBackend) {
      const match = line.match(/^(?:export\s+)?(?:async\s+)?function\s+(handle|process|run|do|execute)\b/);
      if (match) {
        violations.push({
          rule: 'L13', file: rel, line: lineNum, text: trimmed,
          message: `Function name "${match[1]}" is too vague. Fix: describe what it does (e.g. processPayment, handleWebhookDelivery, runMigration). See AGENTS.md anti-pattern #11`,
        });
      }
    }

    // L14: Queries must only import from @types, @services/SQLite, @config — not handlers, not validators, not middlewares
    if (isQuery) {
      const match = line.match(/from\s+['"]@(handlers|validators|middlewares|core)(\/[^'"]*)?['"]/);
      if (match) {
        violations.push({
          rule: 'L14', file: rel, line: lineNum, text: trimmed,
          message: `Queries must not import @${match[1]} — queries are a bottom layer. Fix: only import from @types, @services/SQLite, @config. See .agents/skills/sqlite-usage.md`,
        });
      }
    }

    // L15: Services must only import from @core, @types, @config, @services — not handlers, not queries, not validators, not middlewares
    // Exception: Authenticate imports session queries (createSession, deleteSession) — tightly coupled by design
    if (isService && !rel.includes('Authenticate.ts')) {
      const match = line.match(/from\s+['"]@(handlers|queries|validators|middlewares)(\/[^'"]*)?['"]/);
      if (match) {
        violations.push({
          rule: 'L15', file: rel, line: lineNum, text: trimmed,
          message: `Services must not import @${match[1]} — services are below handlers/queries. Fix: only import from @core, @types, @config, @services. See AGENTS.md mental model`,
        });
      }
    }

    // L16: Validators must only import from @types and zod — not handlers, not queries, not services, not middlewares
    if (isValidator) {
      const match = line.match(/from\s+['"]@(handlers|queries|services|middlewares|core)(\/[^'"]*)?['"]/);
      if (match) {
        violations.push({
          rule: 'L16', file: rel, line: lineNum, text: trimmed,
          message: `Validators must not import @${match[1]} — validators are a bottom layer. Fix: only import from @types and 'zod'. See .agents/skills/error-handling.md`,
        });
      }
    }

    // L17: Middlewares must only import from @core, @queries, @config, @services — not handlers, not validators
    if (isMiddleware) {
      const match = line.match(/from\s+['"]@(handlers|validators)(\/[^'"]*)?['"]/);
      if (match) {
        violations.push({
          rule: 'L17', file: rel, line: lineNum, text: trimmed,
          message: `Middlewares must not import @${match[1]} — middlewares run before handlers. Fix: only import from @core, @queries, @config, @services. See AGENTS.md mental model`,
        });
      }
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
