import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { readNaraCliVersion, resolveNaraPackageRoot } from '../package-root';

const fixtures: string[] = [];

afterEach(() => {
  for (const fixture of fixtures.splice(0)) {
    rmSync(fixture, { recursive: true, force: true });
  }
});

function writeManifest(directory: string, name: string, version = '3.1.0'): string {
  mkdirSync(directory, { recursive: true });
  writeFileSync(path.join(directory, 'package.json'), JSON.stringify({ name, version }));
  return directory;
}

describe('Nara package root discovery', () => {
  it('recognizes the private source package name', () => {
    const root = writeManifest(mkdtempSync(path.join(os.tmpdir(), 'nara-root-')), 'nara');
    fixtures.push(root);
    const nested = path.join(root, 'src', 'cli');
    mkdirSync(nested, { recursive: true });

    expect(resolveNaraPackageRoot(nested)).toBe(root);
    expect(readNaraCliVersion(nested)).toBe('3.1.0');
  });

  it('recognizes the published scoped package name', () => {
    const root = writeManifest(mkdtempSync(path.join(os.tmpdir(), 'nara-scoped-')), '@nara-web/cli');
    fixtures.push(root);
    const nested = path.join(root, 'dist', 'commands');
    mkdirSync(nested, { recursive: true });

    expect(resolveNaraPackageRoot(nested)).toBe(root);
    expect(readNaraCliVersion(nested)).toBe('3.1.0');
  });

  it('prefers the nearest enclosing canonical package', () => {
    const outer = writeManifest(mkdtempSync(path.join(os.tmpdir(), 'nara-outer-')), 'nara');
    fixtures.push(outer);
    const inner = writeManifest(path.join(outer, 'node_modules', '@nara-web', 'cli'), '@nara-web/cli');
    const nested = path.join(inner, 'dist');
    mkdirSync(nested, { recursive: true });

    expect(resolveNaraPackageRoot(nested)).toBe(inner);
  });

  it('rejects unrelated package names', () => {
    const root = writeManifest(mkdtempSync(path.join(os.tmpdir(), 'nara-foreign-')), 'another-nara-tool');
    fixtures.push(root);

    expect(() => resolveNaraPackageRoot(root)).toThrow('Nara package root not found');
  });
});
