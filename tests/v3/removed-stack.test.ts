import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const projectRoot = process.cwd();

function walkFiles(directory: string, extension: (file: string) => boolean, found: string[] = []): string[] {
  for (const entry of readdirSync(directory)) {
    const absolute = path.join(directory, entry);
    if (statSync(absolute).isDirectory()) {
      if (entry === 'node_modules' || entry === 'build' || entry === '.git') continue;
      walkFiles(absolute, extension, found);
    } else if (extension(absolute)) {
      found.push(absolute);
    }
  }
  return found;
}

/** Intentionally removed v2 runtime elements must not creep back in. */
describe('removed v2 stack stays removed', () => {
  it('declares no removed HTTP, frontend, or infrastructure dependencies', () => {
    const manifest = JSON.parse(readFileSync(path.join(projectRoot, 'package.json'), 'utf-8')) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const declared = [...Object.keys(manifest.dependencies ?? {}), ...Object.keys(manifest.devDependencies ?? {})];
    for (const banned of [
      'ultimate-express',
      'uWebSockets.js',
      'express',
      'compression',
      'svelte',
      '@inertiajs/svelte',
      'nuxt',
      'react',
      'react-dom',
      'redis',
    ]) {
      expect(declared, banned).not.toContain(banned);
    }
    // Hono is the only supported HTTP layer.
    expect(declared).toContain('hono');
    expect(declared).toContain('@hono/node-server');
  });

  it('ships no Svelte sources', () => {
    const svelteFiles = walkFiles(projectRoot, (file) => file.endsWith('.svelte'));
    expect(svelteFiles).toEqual([]);
  });

  it('references no removed runtime imports in v3 sources', () => {
    const sources = walkFiles(
      projectRoot,
      (file) => /\.(ts|vue)$/.test(file) && /[\\/]src[\\/]|[\\/]resources[\\/]/.test(file),
    );
    // Import-shaped references only: tests may name the removed stack inside
    // absence assertions without depending on it.
    const bannedImport =
      /(?:from|import|require)\s*\(?\s*['"](?:ultimate-express|uwebsockets\.js|express|compression|svelte|@inertiajs\/[^'"]+|nuxt|react(?:-dom)?|redis)['"]/i;
    const hits = sources.filter((file) => bannedImport.test(readFileSync(file, 'utf-8')));
    expect(hits).toEqual([]);
  });
});
