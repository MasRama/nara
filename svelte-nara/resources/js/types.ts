// User types
export interface User {
  id: string;
  name: string;
  email: string;
  is_admin: boolean;
  is_verified: boolean;
  created_at?: string;
  updated_at?: string;
}

// User form for create/edit
export interface UserForm {
  id?: string;
  name: string;
  email: string;
  password: string;
  is_admin: boolean;
}

// Pagination meta from backend
export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

// Helper to create empty user form
export function createEmptyUserForm(): UserForm {
  return {
    name: '',
    email: '',
    password: '',
    is_admin: false,
  };
}

// Helper to convert User to UserForm for editing
export function userToForm(user: User): UserForm {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    password: '',
    is_admin: user.is_admin,
  };
}
