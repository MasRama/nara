import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { environmentVariables } from '../shared/config';
import './server';

/**
 * The environment templates are the operator's list of settings. Loading the app runs
 * every mounted Feature's configuration, so the variables read at runtime
 * are known without a separate list; scripts read theirs from `process.env`.
 */
const root = process.cwd();
const TEMPLATES = ['.env.example', '.env.production.example'];

function documented(template: string): Set<string> {
  const lines = readFileSync(join(root, template), 'utf8').split('\n');
  return new Set(lines.flatMap((line) => /^#?\s*([A-Z][A-Z0-9_]*)=/.exec(line)?.[1] ?? []));
}

function readByScripts(): Set<string> {
  const names = new Set<string>();
  for (const file of readdirSync(join(root, 'scripts')).filter((name) => name.endsWith('.ts'))) {
    for (const match of readFileSync(join(root, 'scripts', file), 'utf8').matchAll(/process\.env\.([A-Z][A-Z0-9_]*)/g)) {
      names.add(match[1]!);
    }
  }
  return names;
}

describe.each(TEMPLATES)('%s', (template) => {
  it('documents every variable the application reads', () => {
    const missing = [...environmentVariables()]
      .filter(([name]) => !documented(template).has(name))
      .map(([name, owner]) => `${name} (${owner})`);
    expect(missing).toEqual([]);
  });

  it('documents only variables something reads', () => {
    const read = new Set([...environmentVariables().keys(), ...readByScripts()]);
    expect([...documented(template)].filter((name) => !read.has(name))).toEqual([]);
  });
});

describe('environment ownership', () => {
  it('reads Feature settings from their owning Feature', () => {
    expect(environmentVariables().get('AUTH_LOCKOUT_ATTEMPTS')).toBe('auth');
    expect(environmentVariables().get('ACTIVITY_RETENTION_DAYS')).toBe('activity');
  });
});
