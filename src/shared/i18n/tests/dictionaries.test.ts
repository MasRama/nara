import { existsSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import { LOCALES, type PluralMessage } from '../index';

/**
 * Typecheck already proves every locale has exactly the English keys. This
 * proves each translation keeps the same `{placeholders}`, which types cannot
 * see because translations are plain strings.
 */
const root = process.cwd();

function localeDirectories(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (!entry.isDirectory() || entry.name === 'node_modules' || entry.name.startsWith('.')) return [];
    const path = join(directory, entry.name);
    return entry.name === 'locales' && existsSync(join(path, 'en.ts')) ? [path] : localeDirectories(path);
  });
}

function placeholders(message: string | PluralMessage): string[] {
  const text = typeof message === 'string' ? message : `${message.one} ${message.other}`;
  return [...new Set([...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1]!))].sort();
}

const directories = ['src', 'official-features'].flatMap((directory) => localeDirectories(join(root, directory)));

describe('locale dictionaries', () => {
  it('are found for the app and every Feature with a browser surface', () => {
    const found = directories.map((directory) => relative(root, directory));
    expect(found).toEqual(
      expect.arrayContaining([
        'src/app/locales',
        'src/features/activity/web/locales',
        'src/features/auth/web/locales',
        'src/features/users/web/locales',
        'official-features/users/web/locales',
      ]),
    );
  });

  it.each(directories.map((directory) => [relative(root, directory), directory]))(
    '%s keeps the English placeholders in every locale',
    async (_name, directory) => {
      const en = (await import(join(directory, 'en.ts'))).default as Record<string, string | PluralMessage>;
      for (const locale of LOCALES.filter((value) => value !== 'en')) {
        const translated = (await import(join(directory, `${locale}.ts`))).default as Record<string, string | PluralMessage>;
        const mismatched = Object.keys(en).filter(
          (key) => placeholders(en[key]!).join() !== placeholders(translated[key] ?? '').join(),
        );
        expect(mismatched, `${locale} placeholders`).toEqual([]);
      }
    },
  );
});
