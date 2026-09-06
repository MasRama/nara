import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { readFeatureLineage } from '../evolution/lineage';
import { installOfficialFeature, writeFileAtomically } from './install-feature';

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

  it('replaces canonical roots atomically without leaving stage files', () => {
    const fixture = createFixture();
    const destination = path.join(fixture, 'server.ts');
    writeFileSync(destination, 'before\n');

    writeFileAtomically(destination, 'after\n');

    expect(readFileSync(destination, 'utf8')).toBe('after\n');
    expect(existsSync(`${destination}.nara-add-stage`)).toBe(false);
  });

  it('removes the stage file when the composition rename fails', () => {
    const fixture = createFixture();
    const occupied = path.join(fixture, 'server.ts');
    mkdirSync(occupied);
    writeFileSync(path.join(occupied, 'child.ts'), 'blocking directory\n');

    expect(() => writeFileAtomically(occupied, 'after\n')).toThrow();

    expect(existsSync(`${occupied}.nara-add-stage`)).toBe(false);
    expect(existsSync(path.join(occupied, 'child.ts'))).toBe(true);
  });

  it('leaves no stage artifacts behind a refused assembly', () => {
    const fixture = createFixture();
    mkdirSync(path.join(fixture, 'src', 'app'), { recursive: true });
    writeFileSync(path.join(fixture, 'src', 'app', 'server.ts'), 'export const app = {};\n');
    writeFileSync(
      path.join(fixture, 'src', 'app', 'router.ts'),
      'export const router = {};\n',
    );
    const official = mkdtempSync(path.join(os.tmpdir(), 'nara-official-'));
    fixtures.push(official);
    mkdirSync(path.join(official, '.nara', 'assembly'), { recursive: true });
    writeFileSync(path.join(official, 'index.ts'), 'export const galleryRoutes = 1;\n');
    writeFileSync(
      path.join(official, '.nara', 'assembly', 'server.ts'),
      `import type { Hono } from 'hono';\nimport { galleryRoutes } from '../../features/gallery';\n\nexport default function composeGalleryServer(app: Hono): void {\n  app.route('/gallery', galleryRoutes);\n}\n`,
    );

    const result = installOfficialFeature('gallery', fixture, { officialDirectory: official });

    expect(result.ok).toBe(false);
    function stageArtifacts(directory: string): string[] {
      const found: string[] = [];
      for (const entry of readdirSync(directory, { withFileTypes: true })) {
        const full = path.join(directory, entry.name);
        if (entry.isDirectory()) found.push(...stageArtifacts(full));
        else if (entry.isFile() && full.endsWith('.nara-add-stage')) found.push(full);
      }
      return found;
    }
    expect(stageArtifacts(fixture)).toEqual([]);
  });
});
