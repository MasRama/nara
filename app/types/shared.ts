/**
 * Shared types — single source of truth for backend + frontend.
 *
 * Backend imports: `import type { User, Role } from '@types/shared'`
 * Frontend imports: `import type { User, Role } from '../../app/types/shared'`
 *
 * Database model types (with sensitive fields like password) stay in `models.ts`.
 * Frontend-specific types (forms, helpers) stay in `resources/types/`.
 */

export interface User {
  id: string;
  name: string | null;
  email: string;
  avatar?: string | null;
  roles: string[];
  permissions: string[];
  created_at?: number;
  updated_at?: number;
}

export interface Role {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  permissions?: string[];
  user_count?: number;
  created_at?: number;
  updated_at?: number;
}

export interface RoleInfo {
  name: string;
  slug: string;
  description: string | null;
}

export interface Permission {
  id: string;
  name: string;
  slug: string;
  resource: string;
  action: string;
  description: string | null;
}

export type GroupedPermissions = Record<string, Permission[]>;

export interface Session {
  id: string;
  user_id: string;
  user_agent: string | null;
  expires_at: number | null;
}

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: PaginationMeta;
}

export interface ApiSuccessResponse<T = unknown> {
  success: true;
  message: string;
  data?: T;
  meta?: Record<string, unknown>;
}

export interface ApiErrorResponse {
  success: false;
  message: string;
  code?: string;
  errors?: Record<string, string[]>;
}

export type ApiResponse<T = unknown> = ApiSuccessResponse<T> | ApiErrorResponse;
