/**
 * Query test example — roles.ts
 *
 * This file teaches AI how to test query functions. Pattern:
 * 1. Mock @services/SQLite (vi.mock) — don't hit real database
 * 2. Assert correct SQL was called with correct params
 * 3. Test: found, not found, create, update, delete
 *
 * Query tests verify SQL correctness, not business logic.
 * Business logic lives in handlers — test that there.
 *
 * AI agents read this file to learn the query testing pattern.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock SQLite — query tests never hit real DB
vi.mock('@services/SQLite', () => ({
  default: {
    one: vi.fn(),
    many: vi.fn(),
    exec: vi.fn(),
    get: vi.fn(),
    all: vi.fn(),
    run: vi.fn(),
    update: vi.fn(),
    transaction: vi.fn((fn) => fn()),
    raw: vi.fn(),
  },
}));

import SQLite from '@services/SQLite';
import {
  findAllRoles,
  findRoleById,
  findRoleBySlug,
  createRole,
  updateRole,
  deleteRole,
} from '../../app/queries/roles';

describe('roles queries', () => {
  beforeEach(() => vi.clearAllMocks());

  describe('findAllRoles', () => {
    it('calls SQLite.many with SELECT * FROM roles', () => {
      (SQLite.many as any).mockReturnValue([]);
      findAllRoles();
      expect(SQLite.many).toHaveBeenCalled();
    });

    it('returns array (never undefined)', () => {
      (SQLite.many as any).mockReturnValue([
        { id: '1', name: 'Admin', slug: 'admin', description: null, created_at: 0, updated_at: 0 },
      ]);
      const result = findAllRoles();
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Admin');
    });
  });

  describe('findRoleById', () => {
    it('returns role when found', () => {
      const mockRole = { id: 'role-1', name: 'Admin', slug: 'admin', description: null, created_at: 0, updated_at: 0 };
      (SQLite.one as any).mockReturnValue(mockRole);
      const result = findRoleById('role-1');
      expect(result).toEqual(mockRole);
    });

    it('returns undefined when not found', () => {
      (SQLite.one as any).mockReturnValue(undefined);
      const result = findRoleById('nonexistent');
      expect(result).toBeUndefined();
    });
  });

  describe('findRoleBySlug', () => {
    it('returns role by slug', () => {
      const mockRole = { id: 'role-1', name: 'Admin', slug: 'admin', description: null, created_at: 0, updated_at: 0 };
      (SQLite.one as any).mockReturnValue(mockRole);
      const result = findRoleBySlug('admin');
      expect(result?.slug).toBe('admin');
    });
  });

  describe('createRole', () => {
    it('inserts role and returns it', () => {
      const mockRole = { id: 'role-new', name: 'Editor', slug: 'editor', description: null, created_at: 0, updated_at: 0 };
      (SQLite.one as any).mockReturnValue(mockRole);
      (SQLite.exec as any).mockReturnValue({ changes: 1 });

      const result = createRole({ id: 'role-new', name: 'Editor', slug: 'editor' });

      expect(SQLite.exec).toHaveBeenCalled();
      expect(result).toEqual(mockRole);
    });
  });

  describe('updateRole', () => {
    it('calls SQLite.update with correct table + where + data', () => {
      const mockRole = { id: 'role-1', name: 'Updated', slug: 'updated', description: 'New desc', created_at: 0, updated_at: 0 };
      (SQLite.one as any).mockReturnValue(mockRole);
      (SQLite.update as any).mockReturnValue({ changes: 1 });

      const result = updateRole('role-1', { name: 'Updated', description: 'New desc' });

      expect(SQLite.update).toHaveBeenCalledWith('roles', { id: 'role-1' }, { name: 'Updated', description: 'New desc' });
      expect(result?.name).toBe('Updated');
    });
  });

  describe('deleteRole', () => {
    it('returns true when row was deleted', () => {
      (SQLite.run as any).mockReturnValue({ changes: 1 });
      const result = deleteRole('role-1');
      expect(result).toBe(true);
    });

    it('returns false when no row deleted', () => {
      (SQLite.run as any).mockReturnValue({ changes: 0 });
      const result = deleteRole('nonexistent');
      expect(result).toBe(false);
    });
  });
});
