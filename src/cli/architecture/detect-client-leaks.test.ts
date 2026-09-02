import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { detectServerClientLeaks } from './detect-client-leaks';

const fixtures: string[] = [];

afterEach(() => {
  for (const fixture of fixtures.splice(0)) {
    rmSync(fixture, { recursive: true, force: true });
  }
});

function createFixture(): string {
  const fixture = mkdtempSync(path.join(os.tmpdir(), 'nara-client-leak-'));
  fixtures.push(fixture);
  return fixture;
}

function writeFeature(fixture: string, name: string, files: Record<string, string>): void {
  const directory = path.join(fixture, 'src/features', name);
  for (const [file, content] of Object.entries(files)) {
    const filePath = path.join(directory, file);
    mkdirSync(path.dirname(filePath), { recursive: true });
    writeFileSync(filePath, content);
  }
}

describe('server-client boundaries', () => {
  it('reports feature server imports from web code', () => {
    const fixture = createFixture();
    writeFeature(fixture, 'users', {
      'index.ts': 'export const users = true;\n',
      'server/repository.ts': 'export const db = true;\n',
    });
    writeFeature(fixture, 'billing', {
      'index.ts': 'export {};\n',
      'web/client.ts': "import { db } from '../../users/server/repository';\nexport { db };\n",
    });

    const leaks = detectServerClientLeaks(fixture);

    expect(leaks).toHaveLength(1);
    expect(leaks[0]).toMatchObject({
      code: 'SERVER_CLIENT_LEAK',
      feature: 'billing',
      importSpecifier: '../../users/server/repository',
      reason: 'client code imports a feature server module',
    });
  });

  it('allows web code to import shared contracts', () => {
    const fixture = createFixture();
    writeFeature(fixture, 'billing', {
      'index.ts': 'export {};\n',
      'contract.ts': 'export type BillingInput = { amount: number };\n',
      'web/client.ts': "import type { BillingInput } from '../contract';\nexport type { BillingInput };\n",
    });

    expect(detectServerClientLeaks(fixture)).toEqual([]);
  });

  it('reports server-only shared modules and builtins', () => {
    const fixture = createFixture();
    writeFeature(fixture, 'billing', {
      'index.ts': 'export {};\n',
      'web/client.ts': "import { getDatabase } from '@/shared/database';\nimport crypto from 'node:crypto';\nexport { getDatabase, crypto };\n",
    });

    const leaks = detectServerClientLeaks(fixture);

    expect(leaks.map((leak) => leak.importSpecifier)).toEqual(['@/shared/database', 'node:crypto']);
  });
});
