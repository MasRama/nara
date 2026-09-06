import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { readFeatureLineage } from '../evolution/lineage';
import { installOfficialFeature } from './install-feature';

const fixtures: string[] = [];

afterEach(() => {
  for (const fixture of fixtures.splice(0)) {
    rmSync(fixture, { recursive: true, force: true });
  }
});

function createFixture(): string {
  const fixture = mkdtempSync(path.join(os.tmpdir(), 'nara-install-'));
  fixtures.push(fixture);
  return fixture;
}

describe('official feature installation', () => {
  it('installs the open health feature source into a clean project', () => {
    const fixture = createFixture();
    mkdirSync(path.join(fixture, 'src', 'app'), { recursive: true });
    writeFileSync(
      path.join(fixture, 'src', 'app', 'server.ts'),
      `import { Hono } from 'hono';\n\nexport const app = new Hono();\n`,
    );

    const result = installOfficialFeature('health', fixture);

    expect(result.ok).toBe(true);
    expect(existsSync(path.join(fixture, 'src/features/health/index.ts'))).toBe(true);
    expect(existsSync(path.join(fixture, 'src/features/health/contract.ts'))).toBe(true);
    expect(existsSync(path.join(fixture, 'src/features/health/tests/health.test.ts'))).toBe(true);
    expect(readFileSync(path.join(fixture, 'src/features/health/index.ts'), 'utf8')).toContain('healthRoutes');
    expect(existsSync(path.join(fixture, 'src/app/bindings/health.server.ts'))).toBe(true);
    expect(readFileSync(path.join(fixture, 'src/app/server.ts'), 'utf8')).toContain('composeHealthServer(app);');
    const lineage = readFeatureLineage(fixture, 'health');
    expect(lineage?.record.schemaVersion).toBe(1);
    expect(lineage?.record.source).toBe('official-feature');
    expect(lineage?.files.get('index.ts')?.toString()).toContain('healthRoutes');
    expect(lineage?.files.has('tests/health.test.ts')).toBe(true);
  });
});
