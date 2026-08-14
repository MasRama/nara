/**
 * Query test — health.ts
 *
 * Pattern mirrors tests/queries/roles.test.ts:
 * 1. Mock @services/SQLite — don't hit real database
 * 2. Assert pingDatabase returns true on success, false on failure
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@services/SQLite', () => ({
  default: {
    one: vi.fn(),
    many: vi.fn(),
    exec: vi.fn(),
    update: vi.fn(),
    transaction: vi.fn((fn) => fn()),
    raw: vi.fn(),
  },
}));

import SQLite from '@services/SQLite';
import { pingDatabase } from '../../app/queries/health';

describe('health queries', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns true when SELECT 1 succeeds', () => {
    (SQLite.one as any).mockReturnValue({ 1: 1 });
    expect(pingDatabase()).toBe(true);
    expect(SQLite.one).toHaveBeenCalled();
    const strings = (SQLite.one as any).mock.calls[0][0] as string[];
    expect(strings[0].trim()).toBe('SELECT 1');
  });

  it('returns false when database throws', () => {
    (SQLite.one as any).mockImplementation(() => {
      throw new Error('database is closed');
    });
    expect(pingDatabase()).toBe(false);
  });
});
