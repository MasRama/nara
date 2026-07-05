/**
 * Handler tests — users.ts
 *
 * Pattern mirrors tests/handlers/roles.test.ts:
 * 1. Mock @queries + @queries/users + @queries/roles (handlers depend on queries, not real DB)
 * 2. Use mockRequest/mockResponse from tests/helpers/mocks
 * 3. Call handler, assert _status + _body
 * 4. Cover: auth guard, permission guard, validation, happy path, self-protection guards
 *
 * AI agents read this file to learn the user-management testing pattern.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockRequest, mockResponse, mockUser } from '../helpers/mocks';

vi.mock('@queries', () => ({
  getUsersPaginated: vi.fn(() => ({ data: [], total: 0 })),
  createUser: vi.fn(),
  updateUser: vi.fn(),
  deleteUsers: vi.fn(() => 1),
  getUserRoles: vi.fn(() => []),
  getRolesForUsers: vi.fn(() => new Map()),
  isAdmin: vi.fn(() => false),
  hasPermission: vi.fn(() => false),
  syncRoles: vi.fn(),
  findUserById: vi.fn(),
}));

vi.mock('@queries/roles', () => ({
  findAllRoles: vi.fn(() => [
    { id: 'role-admin', name: 'Admin', slug: 'admin', description: null },
    { id: 'role-user', name: 'User', slug: 'user', description: null },
  ]),
  findRoleBySlug: vi.fn((slug: string) =>
    slug === 'admin' ? { id: 'role-admin', name: 'Admin', slug: 'admin' } : undefined
  ),
  getUsersWithRole: vi.fn(() => [{ id: 'user-123' }]),
}));

vi.mock('@services/Authenticate', () => ({
  hashPassword: vi.fn((pw: string) => `hashed-${pw}`),
  comparePassword: vi.fn(),
}));

vi.mock('@services/Logger', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { addUser, editUser, removeUsers, changeProfile } from '../../app/handlers/users';
import { createUser, updateUser, deleteUsers, isAdmin, hasPermission } from '@queries';
import { findRoleBySlug, getUsersWithRole } from '@queries/roles';
import { hashPassword } from '@services/Authenticate';

const UUID_ME = '00000000-0000-4000-8000-000000000001';
const UUID_OTHER = '00000000-0000-4000-8000-000000000002';
const UUID_ADMIN2 = '00000000-0000-4000-8000-000000000003';

describe('users handler', () => {
  beforeEach(() => vi.clearAllMocks());

  describe('addUser', () => {
    it('returns 401 if no user', () => {
      const req = mockRequest({ body: { name: 'Alice', email: 'alice@test.com', password: 'password123' } });
      const res = mockResponse();
      addUser(req as any, res as any);
      expect(res._status).toBe(401);
      expect(res._body).toMatchObject({ success: false, message: 'Unauthorized' });
    });

    it('returns 403 if user lacks users.create and is not admin', () => {
      const req = mockRequest({ user: mockUser(), body: { name: 'Alice', email: 'alice@test.com', password: 'password123' } });
      const res = mockResponse();
      (isAdmin as any).mockReturnValue(false);
      (hasPermission as any).mockReturnValue(false);
      addUser(req as any, res as any);
      expect(res._status).toBe(403);
    });

    it('returns 422 if validation fails', () => {
      const req = mockRequest({ user: mockUser(), body: { name: '', email: 'bad' } });
      const res = mockResponse();
      (isAdmin as any).mockReturnValue(true);
      addUser(req as any, res as any);
      expect(res._status).toBe(422);
      expect(res._body.code).toBe('VALIDATION_ERROR');
    });

    it('creates user with hashed password and returns 201', () => {
      const req = mockRequest({
        user: mockUser(),
        body: { name: 'Alice', email: 'alice@test.com', password: 'password123' },
      });
      const res = mockResponse();
      (isAdmin as any).mockReturnValue(true);
      (createUser as any).mockReturnValue({
        id: 'user-1', name: 'Alice', email: 'alice@test.com',
        created_at: Date.now(), updated_at: Date.now(),
      });
      addUser(req as any, res as any);
      expect(hashPassword).toHaveBeenCalledWith('password123');
      expect(res._status).toBe(201);
      expect(res._body.success).toBe(true);
      expect(res._body.data.user.email).toBe('alice@test.com');
    });

    it('returns 400 DUPLICATE_EMAIL on unique constraint', () => {
      const req = mockRequest({
        user: mockUser(),
        body: { name: 'Alice', email: 'alice@test.com', password: 'password123' },
      });
      const res = mockResponse();
      (isAdmin as any).mockReturnValue(true);
      (createUser as any).mockImplementation(() => {
        const err = new Error('UNIQUE constraint failed') as any;
        err.code = 'SQLITE_CONSTRAINT_UNIQUE';
        throw err;
      });
      addUser(req as any, res as any);
      expect(res._status).toBe(400);
      expect(res._body.code).toBe('DUPLICATE_EMAIL');
    });
  });

  describe('editUser', () => {
    it('returns 401 if no user', () => {
      const req = mockRequest({ params: { id: 'user-1' }, body: { name: 'Bob' } });
      const res = mockResponse();
      editUser(req as any, res as any);
      expect(res._status).toBe(401);
    });

    it('returns 400 if no id param', () => {
      const req = mockRequest({ user: mockUser(), body: { name: 'Bob' } });
      const res = mockResponse();
      editUser(req as any, res as any);
      expect(res._status).toBe(400);
    });

    it('returns 403 if not self, not admin, and lacks users.edit', () => {
      const req = mockRequest({ user: mockUser({ id: 'me' }), params: { id: 'someone-else' }, body: { name: 'Bob' } });
      const res = mockResponse();
      (isAdmin as any).mockReturnValue(false);
      (hasPermission as any).mockReturnValue(false);
      editUser(req as any, res as any);
      expect(res._status).toBe(403);
    });

    it('allows self-update without users.edit permission', () => {
      const req = mockRequest({ user: mockUser({ id: 'me' }), params: { id: 'me' }, body: { name: 'New Me' } });
      const res = mockResponse();
      (isAdmin as any).mockReturnValue(false);
      (hasPermission as any).mockReturnValue(false);
      (updateUser as any).mockReturnValue({ id: 'me', name: 'New Me', email: 'me@test.com' });
      editUser(req as any, res as any);
      expect(res._status).toBe(200);
    });

    it('returns 422 if no fields provided', () => {
      const req = mockRequest({ user: mockUser({ id: 'me' }), params: { id: 'me' }, body: {} });
      const res = mockResponse();
      editUser(req as any, res as any);
      expect(res._status).toBe(422);
    });
  });

  describe('removeUsers', () => {
    it('returns 401 if no user', () => {
      const req = mockRequest({ body: { ids: [UUID_OTHER] } });
      const res = mockResponse();
      removeUsers(req as any, res as any);
      expect(res._status).toBe(401);
    });

    it('returns 403 if not admin and lacks users.delete', () => {
      const req = mockRequest({ user: mockUser({ id: UUID_ME }), body: { ids: [UUID_OTHER] } });
      const res = mockResponse();
      (isAdmin as any).mockReturnValue(false);
      (hasPermission as any).mockReturnValue(false);
      removeUsers(req as any, res as any);
      expect(res._status).toBe(403);
    });

    it('returns 422 if ids missing', () => {
      const req = mockRequest({ user: mockUser({ id: UUID_ME }), body: {} });
      const res = mockResponse();
      (isAdmin as any).mockReturnValue(true);
      removeUsers(req as any, res as any);
      expect(res._status).toBe(422);
    });

    it('blocks self-deletion with SELF_DELETE', () => {
      const req = mockRequest({
        user: mockUser({ id: UUID_ME, roles: ['admin'] }),
        body: { ids: [UUID_ME] },
      });
      const res = mockResponse();
      (isAdmin as any).mockReturnValue(true);
      removeUsers(req as any, res as any);
      expect(res._status).toBe(400);
      expect(res._body.code).toBe('SELF_DELETE');
    });

    it('blocks deleting the last admin with LAST_ADMIN', () => {
      const req = mockRequest({
        user: mockUser({ id: UUID_ME, roles: ['user'] }),
        body: { ids: [UUID_OTHER] },
      });
      const res = mockResponse();
      (isAdmin as any).mockReturnValue(false);
      (hasPermission as any).mockReturnValue(true);
      (findRoleBySlug as any).mockReturnValue({ id: 'role-admin', slug: 'admin' });
      (getUsersWithRole as any).mockReturnValue([{ id: UUID_OTHER }]);
      removeUsers(req as any, res as any);
      expect(res._status).toBe(400);
      expect(res._body.code).toBe('LAST_ADMIN');
    });

    it('deletes and returns count when guards pass', () => {
      const req = mockRequest({
        user: mockUser({ id: UUID_ME, roles: ['admin'] }),
        body: { ids: [UUID_OTHER, UUID_ADMIN2] },
      });
      const res = mockResponse();
      (isAdmin as any).mockReturnValue(true);
      (findRoleBySlug as any).mockReturnValue({ id: 'role-admin', slug: 'admin' });
      (getUsersWithRole as any).mockReturnValue([{ id: UUID_ME }, { id: UUID_ADMIN2 }]);
      (deleteUsers as any).mockReturnValue(2);
      removeUsers(req as any, res as any);
      expect(res._status).toBe(200);
      expect(res._body.data.deleted).toBe(2);
    });
  });

  describe('changeProfile', () => {
    it('returns 401 if no user', () => {
      const req = mockRequest({ body: { name: 'New', email: 'new@test.com' } });
      const res = mockResponse();
      changeProfile(req as any, res as any);
      expect(res._status).toBe(401);
    });

    it('returns 422 if validation fails', () => {
      const req = mockRequest({ user: mockUser(), body: { name: '', email: 'bad' } });
      const res = mockResponse();
      changeProfile(req as any, res as any);
      expect(res._status).toBe(422);
    });

    it('updates and returns success', () => {
      const req = mockRequest({ user: mockUser(), body: { name: 'New Name', email: 'new@test.com' } });
      const res = mockResponse();
      (updateUser as any).mockReturnValue({ id: 'me', name: 'New Name', email: 'new@test.com' });
      changeProfile(req as any, res as any);
      expect(res._status).toBe(200);
      expect(res._body.success).toBe(true);
    });
  });
});
