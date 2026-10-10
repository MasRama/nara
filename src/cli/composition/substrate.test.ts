import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { installOfficialFeature } from './install-feature';
import { checkSharedSubstrate, sharedModuleUses } from './substrate';

const fixtures: string[] = [];

afterEach(() => {
  for (const fixture of fixtures.splice(0)) rmSync(fixture, { recursive: true, force: true });
});

function directory(prefix: string): string {
  const created = mkdtempSync(path.join(os.tmpdir(), prefix));
  fixtures.push(created);
  return created;
}

function write(root: string, relative: string, content: string): void {
  const file = path.join(root, ...relative.split('/'));
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, content);
}

describe('shared substrate an official Feature reaches', () => {
  it('resolves imports from where source and templates land once installed', () => {
    const uses = sharedModuleUses(
      'billing',
      new Map([
        ['server/routes.ts', "import { jsonInput } from '../../../shared/security';\nimport { publish } from '../../../shared/realtime/index';\n"],
        ['contract.ts', "export { emailSchema } from '../../shared/security/input';\n"],
        ['web/pages/Page.vue', "<script setup lang=\"ts\">\nimport { mergeEdit } from '../../../../shared/realtime/browser';\n</script>\n"],
        ['server/aliased.ts', "const config = await import('@/shared/config');\nimport '@shared/database';\n"],
        ['server/local.ts', "import { helper } from './helper';\nimport { z } from 'zod';\n"],
      ]),
      { server: "import { createLocalAssetStorage } from '../../shared/storage';\n" },
    );
    expect(uses.map((use) => `${use.importer} → ${use.entry}`)).toEqual([
      '.nara/assembly/server.ts → storage',
      'contract.ts → security/input',
      'server/aliased.ts → config',
      'server/aliased.ts → database',
      'server/routes.ts → realtime',
      'server/routes.ts → security',
      'web/pages/Page.vue → realtime/browser',
    ]);
  });

  it('refuses modules Nara does not guarantee, and guaranteed ones the application lacks', () => {
    const root = directory('nara-substrate-');
    write(root, 'src/shared/security/index.ts', 'export {};\n');
    write(root, 'src/shared/realtime.ts', 'export {};\n');

    const present = sharedModuleUses('billing', new Map([['index.ts', "import '../../shared/security';\nimport '../../shared/realtime';\n"]]), {});
    expect(checkSharedSubstrate(root, 'billing', present, 'add')).toBeUndefined();

    const tuning = sharedModuleUses('billing', new Map([['server/tune.ts', "import { limits } from '../../../shared/tuning';\n"]]), {});
    expect(checkSharedSubstrate(root, 'billing', tuning, 'add')).toBe(
      'Cannot add "billing": the official source imports src/shared modules Nara does not guarantee (server/tune.ts → src/shared/tuning). '
      + 'Official Features may rely only on src/shared/{config,database,logging,realtime,security,storage}; nothing was installed.',
    );

    const browser = sharedModuleUses('billing', new Map([['web/page.ts', "import '../../../shared/realtime/browser';\n"]]), {});
    expect(checkSharedSubstrate(root, 'billing', browser, 'evolve')).toBe(
      'Cannot evolve "billing": it needs src/shared/realtime/browser, which this application does not provide. '
      + 'Restore it from the Nara reference application first; no files were changed.',
    );
  });

  it('installs nothing when the application lacks a module the package needs', () => {
    const root = directory('nara-substrate-app-');
    write(root, 'src/app/server.ts', "import { Hono } from 'hono';\n\nexport const app = new Hono();\n");
    const official = directory('nara-substrate-official-');
    write(official, 'index.ts', "export { publish } from '../../shared/realtime';\n");

    const result = installOfficialFeature('billing', root, { officialDirectory: official });

    expect(result).toEqual({
      ok: false,
      error: {
        kind: 'prerequisite',
        message:
          'Cannot add "billing": it needs src/shared/realtime, which this application does not provide. '
          + 'Restore it from the Nara reference application first; nothing was installed.',
      },
    });
    expect(existsSync(path.join(root, 'src', 'features', 'billing'))).toBe(false);
    expect(existsSync(path.join(root, '.nara'))).toBe(false);
    expect(readdirSync(path.join(root, 'src'))).toEqual(['app']);
  });
});
