/**
 * Frontend Types
 *
 * Shared types (User, Role, Permission, Session, API responses) are re-exported
 * from app/types/shared.ts — the single source of truth.
 *
 * This file contains only frontend-specific types (forms, helpers, type guards).
 */

// Re-export shared types from backend (single source of truth)
export type {
  User,
  Role,
  RoleInfo,
  Permission,
  GroupedPermissions,
  Session,
  PaginationMeta,
  PaginatedResponse,
  ApiSuccessResponse,
  ApiErrorResponse,
  ApiResponse,
} from '../../app/types/shared';

import type { User, Role } from '../../app/types/shared';

// =============================================================================
// Form Types (frontend-only)
// =============================================================================

export interface UserForm {
  id: string | null;
  name: string;
  email: string;
  roles: string[];
  password: string;
}

export interface RoleForm {
  id: string | null;
  name: string;
  slug: string;
  description: string;
  permissions: string[];
}

// =============================================================================
// Helper Functions (frontend-only)
// =============================================================================

export function createEmptyUserForm(): UserForm {
  return {
    id: null,
    name: '',
    email: '',
    roles: ['user'],
    password: ''
  };
}

export function userToForm(user: User): UserForm {
  return {
    id: user.id,
    name: user.name || '',
    email: user.email || '',
    roles: user.roles || ['user'],
    password: ''
  };
}

export function isApiSuccess<T>(response: import('../../app/types/shared').ApiResponse<T>): response is import('../../app/types/shared').ApiSuccessResponse<T> {
  return response.success === true;
}

export function isApiError(response: import('../../app/types/shared').ApiResponse): response is import('../../app/types/shared').ApiErrorResponse {
  return response.success === false;
}

export function createEmptyRoleForm(): RoleForm {
  return {
    id: null,
    name: '',
    slug: '',
    description: '',
    permissions: [],
  };
}

export function roleToForm(role: Role): RoleForm {
  const permissions = (role.permissions || []).map((p: string | { slug: string }) =>
    typeof p === 'string' ? p : p.slug
  );

  return {
    id: role.id,
    name: role.name || '',
    slug: role.slug || '',
    description: role.description || '',
    permissions,
  };
}
