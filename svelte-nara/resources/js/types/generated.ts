/**
 * Generated Frontend Types
 * 
 * AUTO-GENERATED FILE - DO NOT EDIT DIRECTLY
 * 
 * This file is generated from backend type definitions.
 * Run `node nara generate:types` to regenerate.
 * 
 * Source: app/core/types.ts
 * Generated: 2025-12-05T02:22:48.293Z
 */

// =============================================================================
// User Types (from app/core/types.ts)
// =============================================================================

/**
 * User interface for authenticated requests
 */
export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  avatar?: string;
  is_admin: boolean;
  is_verified: boolean;
  created_at?: number;
  updated_at?: number;
}

// =============================================================================
// Form Types
// =============================================================================

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

// =============================================================================
// Pagination Types
// =============================================================================

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
 * Paginated response wrapper
 */
export interface PaginatedResponse<T> {
  data: T[];
  meta: PaginationMeta;
}

// =============================================================================
// API Response Types
// =============================================================================

/**
 * Standard API success response
 */
export interface ApiSuccessResponse<T = unknown> {
  success: true;
  message: string;
  data?: T;
  meta?: Record<string, unknown>;
}

/**
 * Standard API error response
 */
export interface ApiErrorResponse {
  success: false;
  message: string;
  code?: string;
  errors?: Record<string, string[]>;
}

/**
 * Union type for API responses
 */
export type ApiResponse<T = unknown> = ApiSuccessResponse<T> | ApiErrorResponse;

// =============================================================================
// Helper Functions
// =============================================================================

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

/**
 * Type guard to check if response is successful
 */
export function isApiSuccess<T>(response: ApiResponse<T>): response is ApiSuccessResponse<T> {
  return response.success === true;
}

/**
 * Type guard to check if response is an error
 */
export function isApiError(response: ApiResponse): response is ApiErrorResponse {
  return response.success === false;
}
