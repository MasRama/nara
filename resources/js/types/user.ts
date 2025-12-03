/**
 * Shared User Types
 * 
 * Centralized type definitions for User-related data structures.
 * Used across dashboard, users, and profile pages.
 */

/**
 * User entity from database
 */
export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  avatar?: string;
  is_admin: boolean;
  is_verified: boolean;
}

/**
 * Form data for creating/editing users
 */
export interface UserForm {
  id: string | null;
  name: string;
  email: string;
  phone: string;
  is_admin: boolean;
  is_verified: boolean;
  password: string;
}

/**
 * Pagination metadata from backend
 */
export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

/**
 * Create empty user form
 */
export function createEmptyUserForm(): UserForm {
  return {
    id: null,
    name: '',
    email: '',
    phone: '',
    is_admin: false,
    is_verified: false,
    password: ''
  };
}

/**
 * Convert User to UserForm for editing
 */
export function userToForm(user: User): UserForm {
  return {
    id: user.id,
    name: user.name || '',
    email: user.email || '',
    phone: user.phone || '',
    is_admin: !!user.is_admin,
    is_verified: !!user.is_verified,
    password: ''
  };
}
