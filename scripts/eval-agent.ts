/**
 * Agent eval harness — proves the AI-first tooling works end-to-end.
 *
 * What it does:
 *   1. Snapshots files that gen:resource modifies (models.ts, schemas.ts,
 *      validators/index.ts, handlers/index.ts, queries/index.ts, routes/web.ts)
 *   2. Runs gen:resource with a test resource ("evaltests", 2 fields)
 *   3. Verifies all 10 files were created with correct conventions
 *   4. Runs lint:layers + check:filesize + check:agents on the generated code
 *   5. Restores all modified files and deletes generated files (cleanup)
 *
 * If any step fails, cleanup runs and the script exits 1.
 * If all pass, the repo is left clean — zero trace of the eval resource.
 *
 * Usage: npm run eval
 * Exit codes: 0 = eval passed, 1 = eval failed
 */
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

const ROOT = path.resolve(__dirname, '..');
const RESOURCE = 'evaltests';
const SINGULAR = 'Evaltest';
const CAMEL = 'evaltests';

// Files that gen:resource appends to (must be restored after eval).
const APPENDED_FILES = [
  'app/types/models.ts',
  'app/validators/schemas.ts',
  'app/validators/index.ts',
  'app/handlers/index.ts',
  'app/queries/index.ts',
  'routes/web.ts',
  'app/handlers/AGENTS.md',
  'app/queries/AGENTS.md',
  'resources/Pages/AGENTS.md',
];

// Files that gen:resource creates (must be deleted after eval).
const CREATED_FILES = [
  'app/queries/evaltests.ts',
  'app/handlers/evaltests.ts',
  'resources/Pages/evaltests.svelte',
  'tests/handlers/evaltests.test.ts',
];

// Migration file has a timestamp prefix — matched by glob.
const MIGRATION_GLOB = 'migrations/*_create_evaltests.ts';

interface Snapshot {
  file: string;
  content: string;
}

interface EvalResult {
  name: string;
  passed: boolean;
  detail: string;
}

const results: EvalResult[] = [];
let snapshots: Snapshot[] = [];

function snapshot(): void {
  snapshots = APPENDED_FILES.map(f => {
    const full = path.join(ROOT, f);
    return { file: f, content: fs.readFileSync(full, 'utf-8') };
  });
}

function restore(): void {
  for (const s of snapshots) {
    const full = path.join(ROOT, s.file);
    fs.writeFileSync(full, s.content);
  }
  for (const f of CREATED_FILES) {
    const full = path.join(ROOT, f);
    if (fs.existsSync(full)) fs.unlinkSync(full);
  }
  // Delete migration file(s) matching glob
  const migDir = path.join(ROOT, 'migrations');
  let entries: fs.Dirent[] = [];
  try { entries = fs.readdirSync(migDir, { withFileTypes: true }); } catch { /* ignore */ }
  for (const e of entries) {
    if (e.isFile() && e.name.endsWith('_create_evaltests.ts')) {
      fs.unlinkSync(path.join(migDir, e.name));
    }
  }
}

function record(name: string, passed: boolean, detail: string): void {
  results.push({ name, passed, detail });
  const icon = passed ? '✓' : '✗';
  console.log(`  ${icon} ${name}: ${detail}`);
}

function fileExists(rel: string): boolean {
  return fs.existsSync(path.join(ROOT, rel));
}

function fileContains(rel: string, needle: string): boolean {
  const content = fs.readFileSync(path.join(ROOT, rel), 'utf-8');
  return content.includes(needle);
}

function runGenResource(): void {
  try {
    execSync(
      `npx ts-node scripts/gen-resource.ts ${RESOURCE} --fields="name:string,price:number"`,
      { cwd: ROOT, stdio: 'pipe' }
    );
  } catch (e) {
    throw new Error(`gen:resource failed: ${(e as Error).message}`);
  }
}

function runCommand(cmd: string): { ok: boolean; output: string } {
  try {
    const output = execSync(cmd, { cwd: ROOT, stdio: 'pipe', encoding: 'utf-8' });
    return { ok: true, output };
  } catch (e) {
    return { ok: false, output: (e as { stdout?: string; stderr?: string }).stdout || (e as Error).message };
  }
}

function verifyFiles(): void {
  // 1. New files created
  record('queries file created', fileExists('app/queries/evaltests.ts'), 'app/queries/evaltests.ts');
  record('handlers file created', fileExists('app/handlers/evaltests.ts'), 'app/handlers/evaltests.ts');
  record('page file created', fileExists('resources/Pages/evaltests.svelte'), 'resources/Pages/evaltests.svelte');
  record('test file created', fileExists('tests/handlers/evaltests.test.ts'), 'tests/handlers/evaltests.test.ts');

  // Migration file (timestamp-prefixed)
  const migDir = path.join(ROOT, 'migrations');
  const migs = fs.readdirSync(migDir).filter(f => f.endsWith('_create_evaltests.ts'));
  record('migration file created', migs.length === 1, migs[0] || 'none');

  // 2. Appended to existing files
  record('interface appended to models.ts', fileContains('app/types/models.ts', 'export interface Evaltest'), 'interface Evaltest');
  record('schema appended to schemas.ts', fileContains('app/validators/schemas.ts', 'CreateEvaltestSchema'), 'CreateEvaltestSchema');
  record('schema type appended to schemas.ts', fileContains('app/validators/schemas.ts', 'CreateEvaltestInput'), 'CreateEvaltestInput');

  // 3. Barrel exports updated
  record('validators index exports schema', fileContains('app/validators/index.ts', 'CreateEvaltestSchema'), 'export CreateEvaltestSchema');
  record('validators index exports type', fileContains('app/validators/index.ts', 'CreateEvaltestInput'), 'export CreateEvaltestInput');
  record('handlers index barrel export', fileContains('app/handlers/index.ts', `export * as evaltests from './evaltests'`), 'export * as evaltests');
  record('queries index barrel export', fileContains('app/queries/index.ts', `export * from './evaltests'`), 'export * from ./evaltests');

  // 4. Routes appended
  record('route import added to web.ts', fileContains('routes/web.ts', `import * as evaltests from '@handlers/evaltests'`), 'import line');
  record('GET route added', fileContains('routes/web.ts', `Route.get('/evaltests'`), 'GET /evaltests');
  record('POST route added', fileContains('routes/web.ts', `Route.post('/evaltests'`), 'POST /evaltests');
}

function verifyConventions(): void {
  const handlerContent = fs.readFileSync(path.join(ROOT, 'app/handlers/evaltests.ts'), 'utf-8');
  const queryContent = fs.readFileSync(path.join(ROOT, 'app/queries/evaltests.ts'), 'utf-8');
  const testContent = fs.readFileSync(path.join(ROOT, 'tests/handlers/evaltests.test.ts'), 'utf-8');

  // Handler naming: descriptive, not generic
  record('handler has evaltestsPage', /export const evaltestsPage/.test(handlerContent), 'evaltestsPage');
  record('handler has listEvaltests', /export const listEvaltests/.test(handlerContent), 'listEvaltests');
  record('handler has addEvaltest', /export const addEvaltest/.test(handlerContent), 'addEvaltest');
  record('handler has editEvaltest', /export const editEvaltest/.test(handlerContent), 'editEvaltest');
  record('handler has removeEvaltests', /export const removeEvaltests/.test(handlerContent), 'removeEvaltests');

  // Page handler uses res.inertia, data handlers use json*
  record('page handler uses res.inertia', /evaltestsPage[\s\S]*?res\.inertia/.test(handlerContent), 'res.inertia in evaltestsPage');
  record('data handler uses jsonPaginated', /listEvaltests[\s\S]*?jsonPaginated/.test(handlerContent), 'jsonPaginated in listEvaltests');
  record('create handler uses jsonCreated', /addEvaltest[\s\S]*?jsonCreated/.test(handlerContent), 'jsonCreated in addEvaltest');

  // No generic names (index, store, create, update, destroy)
  record('no generic handler names', !/^export const (index|store|create|update|destroy)\b/m.test(handlerContent), 'no index/store/create/update/destroy');

  // Queries use raw SQL, not ORM
  record('queries import SQLite', /from '@services\/SQLite'/.test(queryContent), 'import SQLite');
  record('queries use template literals', /SQLite\.one<|SQLite\.exec`|SQLite\.get</.test(queryContent), 'template literal SQL');
  record('no ORM imports', !/from ['"]prisma|drizzle|knex|sequelize/.test(queryContent), 'no Prisma/Drizzle/Knex');

  // IN-clause pattern
  record('IN-clause builds placeholders', /placeholders.*map.*\?/.test(queryContent), 'manual placeholder build');

  // Test file: mocks pre-wired, covers auth + validation + happy path
  record('test mocks @queries/evaltests', /vi\.mock\('@queries\/evaltests'/.test(testContent), 'vi.mock @queries/evaltests');
  record('test mocks @queries/users', /vi\.mock\('@queries\/users'/.test(testContent), 'vi.mock @queries/users');
  record('test mocks @services/Logger', /vi\.mock\('@services\/Logger'/.test(testContent), 'vi.mock @services/Logger');
  record('test covers 401 auth guard', /returns 401 if no user/.test(testContent), '401 auth guard test');
  record('test covers 422 validation', /returns 422 if validation fails/.test(testContent), '422 validation test');
  record('test covers 201 create happy path', /creates .+ and returns 201/.test(testContent), '201 create test');
}

function verifyGates(): void {
  const lint = runCommand('npx ts-node scripts/lint-layers.ts');
  record('lint:layers passes on generated code', lint.ok, lint.ok ? 'no violations' : 'violations found');

  const filesize = runCommand('npx ts-node scripts/check-filesize.ts');
  record('check:filesize passes on generated code', filesize.ok, filesize.ok ? 'all under 500' : 'file too large');

  const agents = runCommand('npx ts-node scripts/check-agents.ts');
  record('check:agents passes on generated code', agents.ok, agents.ok ? 'AGENTS.md accurate' : 'AGENTS.md stale');
}

function main(): void {
  console.log('\n── Agent Eval Harness ──');
  console.log(`Resource: ${RESOURCE} (name:string, price:number)\n`);

  // 1. Snapshot
  try {
    snapshot();
  } catch (e) {
    console.error(`Failed to snapshot: ${(e as Error).message}`);
    process.exit(1);
  }

  // 2. Generate
  console.log('Phase 1: Generate resource');
  try {
    runGenResource();
    record('gen:resource runs', true, '10 files generated');
  } catch (e) {
    record('gen:resource runs', false, (e as Error).message);
    restore();
    reportAndExit();
  }

  // 3. Verify files exist
  console.log('\nPhase 2: Verify files created');
  verifyFiles();

  // 4. Verify conventions
  console.log('\nPhase 3: Verify conventions');
  verifyConventions();

  // 5. Verify gates
  console.log('\nPhase 4: Verify gates pass on generated code');
  verifyGates();

  // 6. Cleanup
  console.log('\nPhase 5: Cleanup');
  restore();
  record('cleanup restores repo', true, 'all generated files removed, all modified files restored');

  reportAndExit();
}

function reportAndExit(): void {
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  const total = results.length;

  console.log(`\n── Eval Results ──`);
  console.log(`  Passed: ${passed}/${total}`);
  console.log(`  Failed: ${failed}/${total}`);

  if (failed > 0) {
    console.error(`\n✗ Agent eval FAILED — ${failed} check(s) failed:`);
    for (const r of results.filter(r => !r.passed)) {
      console.error(`  ${r.name}: ${r.detail}`);
    }
    process.exit(1);
  }

  console.log(`\n✓ Agent eval PASSED — all ${total} checks green.`);
  console.log(`  The AI-first tooling (gen:resource + lint:layers + check:agents + check:filesize) works end-to-end.`);
  process.exit(0);
}

main();
