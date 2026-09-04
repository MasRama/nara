import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
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

/**
 * Portable HTTP-stack compatibility audit (runs on any platform).
 *
 * Contract under test is narrow: the Hono + @hono/node-server HTTP path
 * must not use the old Ultimate Express / uWebSockets.js native HTTP
 * runtime. Other native dependencies (e.g. better-sqlite3, Sharp) are
 * legitimate and out of scope here.
 *
 * This audit proves dependency/import hygiene only. Actual Linux runtime
 * evidence (production startup + /proc inspection on Linux) belongs to
 * `tests/integration/linux-deployment.test.ts`, which explicitly requires
 * Linux. See docs/v3/release-checklist.md for how the two compose.
 */
describe('http stack compatibility audit (portable)', () => {
  it('declares Hono without an Ultimate Express / uWebSockets HTTP dependency', () => {
    const manifest = JSON.parse(readFileSync(path.join(projectRoot, 'package.json'), 'utf-8')) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const declared = [...Object.keys(manifest.dependencies ?? {}), ...Object.keys(manifest.devDependencies ?? {})];
    expect(declared).toContain('hono');
    expect(declared).toContain('@hono/node-server');
    for (const banned of ['ultimate-express', 'uWebSockets.js', 'uwebsockets.js']) {
      expect(declared, banned).not.toContain(banned);
    }
  });

  it('pins no Ultimate/uWS package in the lockfile', () => {
    const lockfile = readFileSync(path.join(projectRoot, 'package-lock.json'), 'utf-8');
    expect(lockfile).not.toMatch(/node_modules\/ultimate-express/);
    expect(lockfile).not.toMatch(/node_modules\/uwebsockets/i);
  });

  it('imports no Ultimate/uWS HTTP runtime from active sources', () => {
    const sources = walkFiles(
      projectRoot,
      (file) => /\.(ts|vue)$/.test(file) && /[\\/]src[\\/]|[\\/]scripts[\\/]|[\\/]resources[\\/]/.test(file),
    );
    const bannedImport =
      /(?:from|import|require)\s*\(?\s*['"](?:ultimate-express|uwebsockets\.js)['"]/i;
    const hits = sources.filter((file) => bannedImport.test(readFileSync(file, 'utf-8')));
    expect(hits).toEqual([]);
  });

  it('ships no native binary inside the Hono HTTP adapter path', () => {
    for (const adapterRoot of ['node_modules/@hono', 'node_modules/hono']) {
      const absolute = path.join(projectRoot, adapterRoot);
      if (!existsSync(absolute)) continue;
      const natives = walkFiles(absolute, (file) => /\.(node|so)(\.|$)/.test(file));
      expect(natives, adapterRoot).toEqual([]);
    }
  });

  it('keeps the generated starter on the same Hono HTTP stack', () => {
    const template = readFileSync(path.join(projectRoot, 'src', 'cli', 'commands', 'new-project.ts'), 'utf-8');
    expect(template).toMatch(/@hono\/node-server/);
    expect(template).not.toMatch(/ultimate-express|uwebsockets\.js/i);
  });
});
