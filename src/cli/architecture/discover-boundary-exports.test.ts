import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  boundaryExportNames,
  directlyReexportedContractSymbol,
  discoverBoundaryExportEvidence,
} from './discover-boundary-exports';
import type { BoundaryExportEvidence } from './discover-boundary-exports';

const fixtures: string[] = [];

afterEach(() => {
  for (const fixture of fixtures.splice(0)) {
    rmSync(fixture, { recursive: true, force: true });
  }
});

function createFixture(): string {
  const fixture = mkdtempSync(path.join(os.tmpdir(), 'nara-boundary-exports-'));
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

function findEvidence(
  evidence: BoundaryExportEvidence[],
  exportedName: string,
  boundary: 'public' | 'web' = 'public',
): BoundaryExportEvidence | undefined {
  return evidence.find((value) => value.exportedName === exportedName && value.boundary === boundary);
}

describe('boundary export evidence', () => {
  it('records canonical public and web boundary export syntax', () => {
    const fixture = createFixture();
    writeFeature(fixture, 'auth', {
      'index.ts': `
export const localConst = true;
export function localFunction() {}
export class LocalClass {}
export interface LocalInterface {}
export type LocalType = string;
export enum LocalEnum { Ready }
const listed = true;
export { listed, listed as publicListed };
export default function DefaultExport() {}
export { Named, Named as NamedAlias } from './source';
export type { Typed, Typed as TypedAlias } from './contract';
export { type Typed as TypedAliasTwo } from './contract';
export * from './contract';
`,
      'contract.ts': 'export interface Typed {}\nexport type WebType = string;\n',
      'source.ts': 'export const Named = true;\n',
      'web/index.ts': `
export { WebType } from '../contract';
export type { WebType as BrowserType } from '../contract.ts';
const webLocal = true;
export { webLocal as PublicWebLocal };
export * from '../contract';
`,
      'server/internal.ts': 'export const privateThing = true;\n',
    });
    writeFeature(fixture, 'backend-only', {
      'index.ts': 'export const backendOnly = true;\n',
    });

    const evidence = discoverBoundaryExportEvidence(fixture);
    const authPublic = evidence.filter((value) => value.feature === 'auth' && value.boundary === 'public');
    const authWeb = evidence.filter((value) => value.feature === 'auth' && value.boundary === 'web');

    expect(findEvidence(evidence, 'localConst')).toMatchObject({
      feature: 'auth',
      boundary: 'public',
      boundaryFile: 'src/features/auth/index.ts',
      kind: 'local',
      precision: 'symbol',
      typeOnly: false,
    });
    expect(findEvidence(evidence, 'localFunction')).toMatchObject({ kind: 'local', precision: 'symbol' });
    expect(findEvidence(evidence, 'LocalClass')).toMatchObject({ kind: 'local', precision: 'symbol' });
    expect(findEvidence(evidence, 'LocalInterface')).toMatchObject({
      kind: 'local',
      precision: 'symbol',
      typeOnly: true,
    });
    expect(findEvidence(evidence, 'LocalType')).toMatchObject({ kind: 'local', typeOnly: true });
    expect(findEvidence(evidence, 'LocalEnum')).toMatchObject({ kind: 'local', typeOnly: false });
    expect(findEvidence(evidence, 'listed')).toMatchObject({ kind: 'local', precision: 'symbol' });
    expect(findEvidence(evidence, 'publicListed')).toMatchObject({ kind: 'local', precision: 'symbol' });
    expect(findEvidence(evidence, 'default')).toMatchObject({ kind: 'default', precision: 'symbol' });

    expect(findEvidence(evidence, 'Named')).toMatchObject({
      kind: 'named-reexport',
      precision: 'symbol',
      sourceSpecifier: './source',
      sourceSymbol: 'Named',
      typeOnly: false,
    });
    expect(findEvidence(evidence, 'NamedAlias')).toMatchObject({
      kind: 'named-reexport',
      sourceSpecifier: './source',
      sourceSymbol: 'Named',
      typeOnly: false,
    });
    expect(findEvidence(evidence, 'Typed')).toMatchObject({
      kind: 'named-reexport',
      sourceSpecifier: './contract',
      sourceSymbol: 'Typed',
      typeOnly: true,
    });
    expect(findEvidence(evidence, 'TypedAlias')).toMatchObject({
      kind: 'named-reexport',
      sourceSpecifier: './contract',
      sourceSymbol: 'Typed',
      typeOnly: true,
    });
    expect(findEvidence(evidence, 'TypedAliasTwo')).toMatchObject({
      kind: 'named-reexport',
      sourceSpecifier: './contract',
      sourceSymbol: 'Typed',
      typeOnly: true,
    });

    expect(authPublic.filter((value) => value.kind === 'export-all')).toEqual([
      {
        feature: 'auth',
        boundary: 'public',
        boundaryFile: 'src/features/auth/index.ts',
        kind: 'export-all',
        precision: 'module',
        sourceSpecifier: './contract',
        typeOnly: false,
      },
    ]);
    expect(authPublic.find((value) => value.kind === 'export-all')?.exportedName).toBeUndefined();
    expect(authWeb).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          exportedName: 'WebType',
          kind: 'named-reexport',
          sourceSpecifier: '../contract',
          sourceSymbol: 'WebType',
          typeOnly: false,
        }),
        expect.objectContaining({
          exportedName: 'BrowserType',
          kind: 'named-reexport',
          sourceSpecifier: '../contract.ts',
          sourceSymbol: 'WebType',
          typeOnly: true,
        }),
        expect.objectContaining({ exportedName: 'PublicWebLocal', kind: 'local', precision: 'symbol' }),
        expect.objectContaining({ kind: 'export-all', precision: 'module', sourceSpecifier: '../contract' }),
      ]),
    );
    expect(evidence.some((value) => value.sourceSymbol === 'privateThing')).toBe(false);

    expect(boundaryExportNames(authPublic)).not.toContain('* from ./contract');
    expect(boundaryExportNames(authPublic)).toEqual([
      'LocalClass',
      'LocalEnum',
      'LocalInterface',
      'LocalType',
      'Named',
      'NamedAlias',
      'Typed',
      'TypedAlias',
      'TypedAliasTwo',
      'default',
      'listed',
      'localConst',
      'localFunction',
      'publicListed',
    ]);
    expect(boundaryExportNames(authWeb)).toEqual(['BrowserType', 'PublicWebLocal', 'WebType']);
    expect(evidence.some((value) => value.feature === 'backend-only' && value.boundary === 'web')).toBe(false);
  });

  it('keeps evidence deterministic and omits undefined fields', () => {
    const fixture = createFixture();
    writeFeature(fixture, 'auth', {
      'index.ts': "export type { User as CurrentUser } from './contract';\nexport * from './other';\n",
      'contract.ts': 'export interface User {}\n',
      'other.ts': 'export const other = true;\n',
      'web/index.ts': 'export const page = true;\n',
    });

    const first = discoverBoundaryExportEvidence(fixture);
    const second = discoverBoundaryExportEvidence(fixture);

    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
    expect(first.every((value) => !Object.values(value).includes(undefined))).toBe(true);
  });

  it('proves only direct contract re-exports after path normalization', () => {
    const direct: BoundaryExportEvidence = {
      feature: 'auth',
      boundary: 'public',
      boundaryFile: 'src\\features\\auth\\index.ts',
      exportedName: 'CurrentUser',
      kind: 'named-reexport',
      precision: 'symbol',
      sourceSpecifier: './nested/../contract.ts',
      sourceSymbol: 'User',
      typeOnly: true,
    };
    const webDirect: BoundaryExportEvidence = {
      feature: 'auth',
      boundary: 'web',
      boundaryFile: 'src/features/auth/web/index.ts',
      exportedName: 'BrowserUser',
      kind: 'named-reexport',
      precision: 'symbol',
      sourceSpecifier: '../contract',
      sourceSymbol: 'User',
      typeOnly: true,
    };

    expect(directlyReexportedContractSymbol(direct)).toBe('User');
    expect(directlyReexportedContractSymbol(webDirect)).toBe('User');
    expect(
      directlyReexportedContractSymbol({
        ...direct,
        sourceSpecifier: './other',
      }),
    ).toBeUndefined();
    expect(
      directlyReexportedContractSymbol({
        ...direct,
        kind: 'export-all',
        precision: 'module',
        exportedName: undefined,
        sourceSpecifier: './contract',
      }),
    ).toBeUndefined();
  });
});
