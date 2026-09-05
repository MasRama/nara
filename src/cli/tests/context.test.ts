import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, statSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { ARCHITECTURE_CONSTRAINTS } from '../architecture/context';
import { runCli, type CliIO } from '../router';

const fixtures: string[] = [];
afterEach(() => {
  for (const fixture of fixtures.splice(0)) {
    rmSync(fixture, { recursive: true, force: true });
  }
});

function createFixture(): string {
  const fixture = mkdtempSync(path.join(os.tmpdir(), 'nara-context-'));
  fixtures.push(fixture);
  return fixture;
}

function writeFile(fixture: string, relativePath: string, content: string): void {
  const filePath = path.join(fixture, relativePath);
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, content);
}

function writeFeature(fixture: string, name: string, files: Record<string, string>): void {
  for (const [file, content] of Object.entries(files)) {
    writeFile(fixture, path.join('src/features', name, file), content);
  }
}

function createIO(): CliIO & { output: string[]; errors: string[] } {
  const output: string[] = [];
  const errors: string[] = [];
  return {
    output,
    errors,
    stdout: (message) => output.push(message),
    stderr: (message) => errors.push(message),
  };
}

function runContext(fixture: string, args: string[]): { exitCode: number; stdout: string; stderr: string } {
  const io = createIO();
  const result = runCli(['context', ...args], io, { cwd: fixture });
  return { exitCode: result.exitCode, stdout: io.output.join(''), stderr: io.errors.join('') };
}

function runContextJson(fixture: string, args: string[]): { exitCode: number; payload: Record<string, unknown> } {
  const outcome = runContext(fixture, [...args, '--json']);
  return { exitCode: outcome.exitCode, payload: JSON.parse(outcome.stdout) as Record<string, unknown> };
}

function writeChain(fixture: string): void {
  writeFeature(fixture, 'auth', { 'index.ts': 'export const login = true;\n' });
  writeFeature(fixture, 'users', {
    'index.ts': "import { login } from '@/features/auth';\nexport { login };\n",
    'contract.ts': 'export type UserProfile = { id: string };\n',
    'server/routes.ts': 'export {};\n',
    'web/client.ts': 'export {};\n',
    'tests/routes.test.ts': 'export {};\n',
  });
  writeFeature(fixture, 'billing', {
    'index.ts': "import { login } from '@/features/users';\nexport { login };\n",
  });
  writeFeature(fixture, 'reports', {
    'index.ts': "import { login } from '@/features/billing';\nexport { login };\n",
  });
}

function sortedCopy(values: unknown): unknown {
  return [...(values as string[])].sort();
}

describe('context command', () => {
  it('builds a bounded human pack for a feature without dumping source', () => {
    const fixture = createFixture();
    writeChain(fixture);

    const outcome = runContext(fixture, ['users']);

    expect(outcome.exitCode).toBe(0);
    expect(outcome.stdout).toContain('Feature context: users');
    expect(outcome.stdout).toContain('Selected by: feature');
    expect(outcome.stdout).toContain('Work in: src/features/users');
    expect(outcome.stdout).toContain('Public boundary: src/features/users/index.ts');
    expect(outcome.stdout).toContain('Public API:\n- login');
    expect(outcome.stdout).toContain('Contracts:\n- UserProfile');
    expect(outcome.stdout).toContain('Depends on:\n- auth');
    expect(outcome.stdout).toContain('Affected dependents:\n- billing\n- reports');
    expect(outcome.stdout).toContain('Architecture constraints:');
    expect(outcome.stdout).toContain(
      'Cross-Feature consumers must import through the Feature public boundary',
    );
    expect(outcome.stdout).toContain('Current architecture issues:\n- none');
    expect(outcome.stdout).toContain('Read first:\n1. src/features/users/index.ts');
    expect(outcome.stdout).not.toContain('import { login }');
    expect(outcome.stderr).toBe('');
  });

  it('emits the machine-readable Architecture Context Pack as JSON', () => {
    const fixture = createFixture();
    writeChain(fixture);

    const { exitCode, payload } = runContextJson(fixture, ['users']);

    expect(exitCode).toBe(0);
    expect(payload['schemaVersion']).toBe(1);
    expect(payload['target']).toEqual({ feature: 'users', selectedBy: 'feature' });
    expect(payload['ownership']).toMatchObject({
      directory: 'src/features/users',
      publicBoundary: 'src/features/users/index.ts',
    });
    expect((payload['ownership'] as { ownedFiles: string[] }).ownedFiles).toContain(
      'src/features/users/server/routes.ts',
    );
    expect(payload['publicApi']).toMatchObject({ exports: ['login'], contracts: ['UserProfile'] });
    expect(payload['relationships']).toEqual({
      dependencies: ['auth'],
      directDependents: ['billing'],
      transitiveDependents: ['reports'],
    });
    expect(payload['surfaces']).toMatchObject({
      server: ['src/features/users/server/routes.ts'],
      web: ['src/features/users/web/client.ts'],
      tests: ['src/features/users/tests/routes.test.ts'],
    });
    expect(payload['constraints']).toHaveLength(5);
    expect(payload['diagnostics']).toEqual([]);
    const readingOrder = payload['readingOrder'] as Array<{ path: string; reason: string }>;
    expect(readingOrder[0]).toEqual({
      path: 'src/features/users/index.ts',
      reason: 'Public boundary of the users Feature.',
    });
    expect(readingOrder[1]).toEqual({
      path: 'src/features/users/contract.ts',
      reason: 'Shared contract of the users Feature.',
    });
  });

  it('never outputs undefined in JSON mode', () => {
    const fixture = createFixture();
    writeChain(fixture);

    const outcome = runContext(fixture, ['users', '--json']);

    expect(outcome.exitCode).toBe(0);
    expect(outcome.stdout).not.toContain('undefined');
    expect(outcome.stdout).not.toContain('Feature context:');
  });

  it('resolves the owning feature from --file', () => {
    const fixture = createFixture();
    writeChain(fixture);

    const outcome = runContext(fixture, ['--file', 'src/features/users/server/routes.ts']);
    const { payload } = runContextJson(fixture, ['--file', 'src/features/users/server/routes.ts']);

    expect(outcome.exitCode).toBe(0);
    expect(outcome.stdout).toContain('Feature context: users');
    expect(outcome.stdout).toContain('Selected by: file');
    expect(outcome.stdout).toContain('Source file: src/features/users/server/routes.ts');
    expect(payload['target']).toEqual({
      feature: 'users',
      selectedBy: 'file',
      sourceFile: 'src/features/users/server/routes.ts',
    });
  });

  it('produces identical facts for feature and owning-file targeting', () => {
    const fixture = createFixture();
    writeChain(fixture);

    const byFeature = runContextJson(fixture, ['users']).payload;
    const byFile = runContextJson(fixture, ['--file', 'src/features/users/index.ts']).payload;

    const { target: _featureTarget, ...featureRest } = byFeature;
    const { target: _fileTarget, ...fileRest } = byFile;
    expect(fileRest).toEqual(featureRest);
    expect(_fileTarget).toEqual({
      feature: 'users',
      selectedBy: 'file',
      sourceFile: 'src/features/users/index.ts',
    });
  });

  it('absolute and relative --file targeting agree', () => {
    const fixture = createFixture();
    writeChain(fixture);
    const absolute = path.join(fixture, 'src/features/users/server/routes.ts');

    const relative = runContextJson(fixture, ['--file', 'src/features/users/server/routes.ts']).payload;
    const fromAbsolute = runContextJson(fixture, ['--file', absolute]).payload;

    expect(fromAbsolute).toEqual(relative);
  });

  it('fails clearly for a file outside any feature', () => {
    const fixture = createFixture();
    writeChain(fixture);
    writeFile(fixture, 'src/app/server.ts', 'export {};\n');

    const outcome = runContext(fixture, ['--file', 'src/app/server.ts']);
    const machine = runContext(fixture, ['--file', 'src/app/server.ts', '--json']);

    expect(outcome.exitCode).toBe(1);
    expect(outcome.stderr).toContain('not owned by a discovered Feature');
    expect(machine.exitCode).toBe(1);
    expect(machine.stdout).toContain('not owned by a discovered Feature');
  });

  it('fails for a file outside the repository', () => {
    const fixture = createFixture();
    writeChain(fixture);
    const outside = path.join(os.tmpdir(), `nara-outside-${Date.now()}.ts`);
    writeFileSync(outside, 'export {};\n');
    try {
      const outcome = runContext(fixture, ['--file', outside]);

      expect(outcome.exitCode).toBe(1);
      expect(outcome.stderr).toContain('outside the repository');
    } finally {
      rmSync(outside, { force: true });
    }
  });

  it('rejects directories passed to --file', () => {
    const fixture = createFixture();
    writeChain(fixture);

    const outcome = runContext(fixture, ['--file', 'src/features/users']);

    expect(outcome.exitCode).toBe(1);
    expect(outcome.stderr).toContain('is a directory');
  });

  it('reports unknown features without a stack trace', () => {
    const fixture = createFixture();
    writeChain(fixture);

    const outcome = runContext(fixture, ['missing']);

    expect(outcome.exitCode).toBe(1);
    expect(outcome.stderr).toContain('Unknown feature "missing"');
    expect(outcome.stderr).not.toContain('at ');
  });

  it('keeps owned files deterministic and sorted', () => {
    const fixture = createFixture();
    writeChain(fixture);

    const first = runContextJson(fixture, ['users']).payload['ownership'] as { ownedFiles: string[] };
    const second = runContextJson(fixture, ['users']).payload['ownership'] as { ownedFiles: string[] };

    expect(first.ownedFiles).toEqual(second.ownedFiles);
    expect(first.ownedFiles).toEqual(sortedCopy(first.ownedFiles));
    expect(first.ownedFiles).toEqual([
      'src/features/users/contract.ts',
      'src/features/users/index.ts',
      'src/features/users/server/routes.ts',
      'src/features/users/tests/routes.test.ts',
      'src/features/users/web/client.ts',
    ]);
  });

  it('keeps JSON ordering deterministic across runs', () => {
    const fixture = createFixture();
    writeChain(fixture);

    const first = runContext(fixture, ['users', '--json']).stdout;
    const second = runContext(fixture, ['users', '--json']).stdout;
    const payload = JSON.parse(first) as { relationships: Record<string, string[]> };

    expect(first).toBe(second);
    for (const key of ['dependencies', 'directDependents', 'transitiveDependents'] as const) {
      expect(payload.relationships[key]).toEqual(sortedCopy(payload.relationships[key]));
    }
  });

  it('exposes stable architecture constraints', () => {
    const fixture = createFixture();
    writeChain(fixture);

    const first = runContextJson(fixture, ['users']).payload['constraints'] as Array<{
      code: string;
      description: string;
    }>;
    const second = runContextJson(fixture, ['billing']).payload['constraints'] as Array<{
      code: string;
      description: string;
    }>;

    expect(first).toEqual(second);
    expect(first.map((constraint) => constraint.code)).toEqual(
      ARCHITECTURE_CONSTRAINTS.map((constraint) => constraint.code),
    );
    expect(first.map((constraint) => constraint.code)).toEqual([
      'PUBLIC_BOUNDARY_IS_INDEX',
      'CROSS_FEATURE_USES_PUBLIC_BOUNDARY',
      'FEATURE_INTERNALS_PRIVATE',
      'NO_SERVER_INTO_CLIENT',
      'CANONICAL_FEATURE_SHAPE',
    ]);
  });

  it('scopes doctor diagnostics to the owning feature only', () => {
    const fixture = createFixture();
    writeFeature(fixture, 'users', {
      'index.ts': 'export const users = 1;\n',
      'server/repository.ts': 'export const findUserById = 1;\n',
    });
    writeFeature(fixture, 'billing', {
      'index.ts': 'export const billing = 1;\n',
      'server/checkout.ts':
        "import { findUserById } from '@/features/users/server/repository';\nexport const checkout = 1;\n",
    });
    writeFeature(fixture, 'auth', { 'index.ts': 'export const login = true;\n' });

    const billing = runContextJson(fixture, ['billing']).payload['diagnostics'] as Array<{
      code: string;
      file: string;
    }>;
    const users = runContextJson(fixture, ['users']).payload['diagnostics'] as unknown[];
    const auth = runContextJson(fixture, ['auth']).payload['diagnostics'] as unknown[];

    expect(billing.some((issue) => issue.code === 'CROSS_FEATURE_INTERNAL_IMPORT')).toBe(true);
    expect(billing.every((issue) => issue.file.startsWith('src/features/billing/'))).toBe(true);
    expect(users).toEqual([]);
    expect(auth).toEqual([]);
  });

  it('surfaces feature-local diagnostics in human output', () => {
    const fixture = createFixture();
    writeFeature(fixture, 'users', {
      'index.ts': 'export const users = 1;\n',
      'server/repository.ts': 'export const findUserById = 1;\n',
    });
    writeFeature(fixture, 'billing', {
      'index.ts': 'export const billing = 1;\n',
      'server/checkout.ts':
        "import { findUserById } from '@/features/users/server/repository';\nexport const checkout = 1;\n",
    });

    const outcome = runContext(fixture, ['billing']);

    expect(outcome.exitCode).toBe(0);
    expect(outcome.stdout).toContain('CROSS_FEATURE_INTERNAL_IMPORT');
  });


  it('includes integrations and relevant application roots for feature and file targets', () => {
    const fixture = createFixture();
    writeFeature(fixture, 'users', {
      'index.ts': 'export const userRoutes = true;\n',
      'server/routes.ts': 'export const routeSurface = true;\n',
      'web/index.ts': 'export const UsersPage = true;\n',
    });
    writeFile(
      fixture,
      'src/app/server.ts',
      `import { Hono } from 'hono';
import { userRoutes } from '../features/users';
const app = new Hono();
app.route('/api/users', userRoutes);
`,
    );
    writeFile(
      fixture,
      'src/app/router.ts',
      `import { createRouter } from 'vue-router';
import { UsersPage } from '../features/users/web';
createRouter({ routes: [{ path: '/users', name: 'users', component: UsersPage }] });
`,
    );

    const human = runContext(fixture, ['users']);
    expect(human.stdout).toContain('Application integration:');
    expect(human.stdout).toContain('Server routes:\n- /api/users via userRoutes');
    expect(human.stdout).toContain('Web routes:\n- /users via UsersPage (name: users)');
    const byFeature = runContextJson(fixture, ['users']).payload;
    const byFile = runContextJson(fixture, ['--file', 'src/features/users/server/routes.ts']).payload;

    expect(byFeature.integrations).toEqual({
      applicationImports: [
        {
          feature: 'users',
          appFile: 'src/app/router.ts',
          boundary: 'web',
          symbols: ['UsersPage'],
        },
        {
          feature: 'users',
          appFile: 'src/app/server.ts',
          boundary: 'public',
          symbols: ['userRoutes'],
        },
      ],
      serverRoutes: [
        {
          feature: 'users',
          appFile: 'src/app/server.ts',
          exportName: 'userRoutes',
          mountPath: '/api/users',
        },
      ],
      webRoutes: [
        {
          feature: 'users',
          appFile: 'src/app/router.ts',
          exportName: 'UsersPage',
          path: '/users',
          name: 'users',
        },
      ],
    });
    const { target: _featureTarget, ...featureFacts } = byFeature;
    const { target: _fileTarget, ...fileFacts } = byFile;
    expect(fileFacts).toEqual(featureFacts);
    const readingPaths = (byFeature.readingOrder as Array<{ path: string }>).map((entry) => entry.path);
    expect(readingPaths.slice(0, 4)).toEqual([
      'src/features/users/index.ts',
      'src/app/server.ts',
      'src/app/router.ts',
      'src/features/users/server/routes.ts',
    ]);
  });
  it('lists direct dependency boundaries in reading order without duplicates', () => {
    const fixture = createFixture();
    writeChain(fixture);

    const readingOrder = runContextJson(fixture, ['users']).payload['readingOrder'] as Array<{
      path: string;
      reason: string;
    }>;
    const paths = readingOrder.map((entry) => entry.path);

    expect(paths).toEqual([...new Set(paths)]);
    expect(readingOrder).toContainEqual({
      path: 'src/features/auth/index.ts',
      reason: 'Public boundary of direct dependency auth.',
    });
    expect(paths.indexOf('src/features/users/index.ts')).toBe(0);
  });

  it('keeps human output bounded while JSON keeps every owned file', () => {
    const fixture = createFixture();
    writeChain(fixture);
    writeFile(fixture, 'src/features/users/scratch.txt', 'local notes\n');

    const human = runContext(fixture, ['users']);
    const machine = runContextJson(fixture, ['users']);
    const ownedFiles = (machine.payload['ownership'] as { ownedFiles: string[] }).ownedFiles;

    expect(ownedFiles).toContain('src/features/users/scratch.txt');
    expect(human.stdout).not.toContain('scratch.txt');
  });

  it('behaves identically from source and staged/built execution', () => {
    const fixture = createFixture();
    writeChain(fixture);
    const repoRoot = path.resolve(__dirname, '..', '..', '..');
    const candidates = [
      path.join(repoRoot, 'packages', 'nara', 'dist', 'index.js'),
      path.join(repoRoot, 'build', 'src', 'cli', 'index.js'),
    ];
    const entrypoint = candidates.find((candidate) => existsSync(candidate));
    if (!entrypoint) {
      return;
    }
    // A build older than the context sources predates the current pack shape;
    // only assert parity against a fresh build (validation rebuilds first).
    const sourceMtime = Math.max(
      statSync(path.join(repoRoot, 'src/cli/architecture/context.ts')).mtimeMs,
      statSync(path.join(repoRoot, 'src/cli/router.ts')).mtimeMs,
    );
    if (statSync(entrypoint).mtimeMs < sourceMtime) {
      return;
    }
    const expected = runContextJson(fixture, ['users']).payload;
    const raw = execFileSync('node', [entrypoint, 'context', 'users', '--json'], {
      cwd: fixture,
      encoding: 'utf8',
    });
    expect(JSON.parse(raw)).toEqual(expected);
    const expectedFile = runContextJson(fixture, ['--file', 'src/features/users/index.ts']).payload;
    const rawFile = execFileSync(
      'node',
      [entrypoint, 'context', '--file', 'src/features/users/index.ts', '--json'],
      { cwd: fixture, encoding: 'utf8' },
    );
    expect(JSON.parse(rawFile)).toEqual(expectedFile);
  });
});
