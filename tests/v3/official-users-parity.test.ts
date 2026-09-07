// @vitest-environment node
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();

function source(relativePath: string): string {
  return readFileSync(path.join(root, 'src', 'features', 'users', relativePath), 'utf8');
}

function official(relativePath: string): string {
  return readFileSync(path.join(root, 'official-features', 'users', relativePath), 'utf8');
}

describe('official Users parity', () => {
  const runtimeFiles = [
    'contract.ts',
    'index.ts',
    'server/assets-routes.ts',
    'server/assets.ts',
    'server/host.ts',
    'server/routes.ts',
    'web/client.ts',
    'web/host.ts',
    'web/index.ts',
    'web/pages/ProfilePage.vue',
    'web/pages/UsersPage.vue',
  ];

  for (const relativePath of runtimeFiles) {
    it(`keeps ${relativePath} aligned with the reference Feature`, () => {
      expect(official(relativePath)).toBe(source(relativePath));
    });
  }

  it('keeps the default server binding aligned with the reference app', () => {
    expect(official('.nara/assembly/server.ts')).toBe(
      readFileSync(path.join(root, 'src', 'app', 'bindings', 'users.server.ts'), 'utf8'),
    );
  });

  it('keeps the default web binding aligned with the reference app', () => {
    expect(official('.nara/assembly/web.ts')).toBe(
      readFileSync(path.join(root, 'src', 'app', 'bindings', 'users.web.ts'), 'utf8'),
    );
  });
});
