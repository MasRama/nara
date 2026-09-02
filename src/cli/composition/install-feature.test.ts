import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
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

    const result = installOfficialFeature('health', fixture);

    expect(result.ok).toBe(true);
    expect(existsSync(path.join(fixture, 'src/features/health/index.ts'))).toBe(true);
    expect(existsSync(path.join(fixture, 'src/features/health/contract.ts'))).toBe(true);
    expect(existsSync(path.join(fixture, 'src/features/health/tests/health.test.ts'))).toBe(true);
    expect(readFileSync(path.join(fixture, 'src/features/health/index.ts'), 'utf8')).toContain('healthRoutes');
  });
});
