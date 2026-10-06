import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const projectRoot = process.cwd();

function guidanceFiles(): string[] {
  return [
    path.join(projectRoot, 'AGENTS.md'),
    path.join(projectRoot, 'ARCHITECTURE.md'),
  ];
}

describe('agent guidance', () => {
  it('keeps repository guidance concentrated in root authority files', () => {
    expect(existsSync(path.join(projectRoot, '.agents'))).toBe(false);
    expect(existsSync(path.join(projectRoot, 'AGENTS.md'))).toBe(true);
    expect(existsSync(path.join(projectRoot, 'ARCHITECTURE.md'))).toBe(true);
  });

  it('keeps obsolete rewrite material out of the active tree', () => {
    expect(existsSync(path.join(projectRoot, 'docs', 'archive'))).toBe(false);
    expect(existsSync(path.join(projectRoot, 'TODO.md'))).toBe(false);
    expect(existsSync(path.join(projectRoot, 'V3_SPEC.md'))).toBe(false);

    const stale = [
      '@inertiajs/',
      'res.inertia',
      '$state(',
      '$derived(',
      'bits-ui',
      'routes/web.ts',
      'app/handlers',
      'app/queries',
      'app/services',
      'resources/Pages',
      'docs/archive',
    ];
    for (const file of guidanceFiles()) {
      const content = readFileSync(file, 'utf-8');
      for (const pattern of stale) {
        expect(content, `${file} contains stale guidance: ${pattern}`).not.toContain(pattern);
      }
    }
  });

  it('resolves relative documentation links from guidance entry points', () => {
    for (const relative of ['AGENTS.md', 'ARCHITECTURE.md']) {
      const file = path.join(projectRoot, relative);
      const content = readFileSync(file, 'utf-8');
      for (const match of content.matchAll(/\]\((\.[^)]+)\)/g)) {
        const target = match[1].split('#')[0];
        expect(existsSync(path.resolve(path.dirname(file), target)), `${relative} links to missing ${target}`).toBe(true);
      }
    }
  });

  it('references only npm scripts that exist', () => {
    const manifest = JSON.parse(readFileSync(path.join(projectRoot, 'package.json'), 'utf-8')) as {
      scripts?: Record<string, string>;
    };
    const scripts = new Set(Object.keys(manifest.scripts ?? {}));

    for (const file of guidanceFiles()) {
      const content = readFileSync(file, 'utf-8');
      for (const match of content.matchAll(/npm run ([a-z0-9:.-]+)/gi)) {
        expect(scripts.has(match[1]), `${file} references missing npm script ${match[1]}`).toBe(true);
      }
    }
  });

});
