import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { analyzeArchitecture } from './doctor';

const fixturesRoot = path.resolve(__dirname, '../../../tests/fixtures/architecture');

function fixture(name: string): string {
  return path.join(fixturesRoot, name);
}

describe('architecture fixtures', () => {
  it.each(['valid-small', 'valid-multi-feature', 'valid-browser-boundary'])('accepts %s', (name) => {
    expect(analyzeArchitecture(fixture(name))).toEqual({ healthy: true, issues: [] });
  });

  it.each([
    ['invalid-internal-import', ['CROSS_FEATURE_INTERNAL_IMPORT']],
    ['invalid-browser-boundary', ['APPLICATION_FEATURE_INTERNAL_IMPORT', 'APPLICATION_FEATURE_INTERNAL_IMPORT', 'CROSS_FEATURE_INTERNAL_IMPORT', 'CROSS_FEATURE_INTERNAL_IMPORT']],
    ['invalid-cycle', ['CIRCULAR_FEATURE_DEPENDENCY']],
    ['invalid-server-client-leak', ['SERVER_CLIENT_LEAK', 'SERVER_CLIENT_LEAK']],
    ['invalid-feature-shape', ['INVALID_FEATURE_SHAPE']],
  ] as const)('rejects %s with the expected rule diagnostics', (name, issueCodes) => {
    const report = analyzeArchitecture(fixture(name));

    expect(report.healthy).toBe(false);
    expect(report.issues.map((issue) => issue.code)).toEqual(issueCodes);
    expect(report.issues.every((issue) => issue.file && issue.relationship && issue.reason && issue.suggestion)).toBe(true);
  });
  it('suggests the browser-safe barrel for browser internal imports', () => {
    const report = analyzeArchitecture(fixture('invalid-browser-boundary'));

    expect(report.issues.filter((issue) => issue.code === 'APPLICATION_FEATURE_INTERNAL_IMPORT')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ suggestion: expect.stringContaining('@/features/auth/web') }),
      ]),
    );
    expect(report.issues.filter((issue) => issue.code === 'CROSS_FEATURE_INTERNAL_IMPORT')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ suggestion: expect.stringContaining('@/features/auth/web') }),
      ]),
    );
  });
});
