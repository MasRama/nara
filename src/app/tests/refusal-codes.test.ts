import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { API_REFUSAL_CODES } from '../../shared/security/codes';

// Every route can be answered by the pipeline ahead of it, so each code that
// pipeline sends must be one every Feature's contract already accepts.
const PIPELINE_SOURCES = [
  ...readdirSync('src/shared/security')
    .filter((file) => file.endsWith('.ts'))
    .map((file) => join('src/shared/security', file)),
  'src/app/error-handler.ts',
  'src/features/auth/server/password-change-gate.ts',
];

describe('API refusal codes', () => {
  it('declares every code the shared pipeline answers with', () => {
    const sent = new Set<string>();
    for (const source of PIPELINE_SOURCES) {
      for (const match of readFileSync(source, 'utf8').matchAll(/code(?::| =) '([A-Z][A-Z0-9_]+)'/g)) sent.add(match[1]);
    }

    expect(sent.size).toBeGreaterThan(5);
    expect([...sent].filter((code) => !(API_REFUSAL_CODES as readonly string[]).includes(code))).toEqual([]);
  });
});
