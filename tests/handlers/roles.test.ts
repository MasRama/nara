/**
 * Handler test example — roles.ts
 *
 * This file teaches AI how to test handlers. Pattern:
 * 1. Mock @queries (vi.mock) — handlers depend on queries, not real DB
 * 2. Use mockRequest/mockResponse from tests/helpers/mocks
 * 3. Call handler, assert response status + body
 * 4. Test: auth check, validation, happy path, error path
 *
 * AI agents read this file to learn the testing pattern.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockRequest, mockResponse, mockUser } from '../helpers/mocks';

// Mock queries — handlers never touch real DB in tests
vi.mock('@queries/roles', () => ({
  findAllRoles: vi.fn(() => [
    { id: 'role-1', name: 'Admin', slug: 'admin', description: null, created_at: 1000, updated_at: 1000 },
    { id: 'role-2', name: 'User', slug: 'user', description: null, created_at: 2000, updated_at: 2000 },
  ]),
  findRoleById: vi.fn(),
  createRole: vi.fn(),
  updateRole: vi.fn(),
  deleteRole: vi.fn(),
  getRolePermissions: vi.fn(() => []),
  getPermissionsForRoles: vi.fn(() => new Map()),
  getUserCountsForRoles: vi.fn(() => new Map()),
  syncRolePermissions: vi.fn(),
  findAllPermissions: vi.fn(() => []),
}));

vi.mock('@queries/users', () => ({
  isAdmin: vi.fn(() => false),
  hasPermission: vi.fn(() => false),
}));

vi.mock('@queries', () => ({
  findSessionById: vi.fn(),
  findUserById: vi.fn(),
}));

vi.mock('@services/Logger', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { listRoles, addRole, removeRole } from '../../app/handlers/roles';
import { findAllRoles, createRole } from '@queries/roles';
import { isAdmin, hasPermission } from '@queries/users';

describe('roles handler', () => {
  beforeEach(() => vi.clearAllMocks());

  describe('listRoles', () => {
    it('returns 401 if no user', () => {
      const req = mockRequest();
      const res = mockResponse();
      listRoles(req as any, res as any);
      expect(res._status).toBe(401);
      expect(res._body).toMatchObject({ success: false, message: 'Unauthorized' });
    });

    it('returns 403 if user has no permission', () => {
      const req = mockRequest({ user: mockUser() });
      const res = mockResponse();
      (isAdmin as any).mockReturnValue(false);
      (hasPermission as any).mockReturnValue(false);
      listRoles(req as any, res as any);
      expect(res._status).toBe(403);
    });

    it('returns roles with permissions + user_count', () => {
      const req = mockRequest({ user: mockUser() });
      const res = mockResponse();
      (isAdmin as any).mockReturnValue(true);
      listRoles(req as any, res as any);
      expect(res._status).toBe(200);
      expect(res._body.success).toBe(true);
      expect(res._body.data).toHaveLength(2);
      expect(res._body.data[0]).toHaveProperty('permissions');
      expect(res._body.data[0]).toHaveProperty('user_count');
    });
  });

  describe('addRole', () => {
    it('returns 401 if no user', () => {
      const req = mockRequest({ body: { name: 'Test', slug: 'test' } });
      const res = mockResponse();
      addRole(req as any, res as any);
      expect(res._status).toBe(401);
    });

    it('returns 422 if validation fails', () => {
      const req = mockRequest({ user: mockUser(), body: { name: '', slug: '' } });
      const res = mockResponse();
      addRole(req as any, res as any);
      expect(res._status).toBe(422);
      expect(res._body.success).toBe(false);
      expect(res._body.code).toBe('VALIDATION_ERROR');
    });

    it('creates role and returns 201', () => {
      const req = mockRequest({
        user: mockUser(),
        body: { name: 'Editor', slug: 'editor', description: 'Can edit content' },
      });
      const res = mockResponse();
      (isAdmin as any).mockReturnValue(true);
      (createRole as any).mockReturnValue({
        id: 'role-new', name: 'Editor', slug: 'editor', description: 'Can edit content',
        created_at: Date.now(), updated_at: Date.now(),
      });
      addRole(req as any, res as any);
      expect(res._status).toBe(201);
      expect(res._body.success).toBe(true);
      expect(res._body.data.role.name).toBe('Editor');
    });
  });

  describe('removeRole', () => {
    it('returns 401 if no user', () => {
      const req = mockRequest();
      const res = mockResponse();
      removeRole(req as any, res as any);
      expect(res._status).toBe(401);
    });

    it('returns 400 if no id param', () => {
      const req = mockRequest({ user: mockUser() });
      const res = mockResponse();
      removeRole(req as any, res as any);
      expect(res._status).toBe(400);
    });
  });
});
