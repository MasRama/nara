/**
 * Validation Schemas
 * 
 * Simple validation functions for all API endpoints.
 * No external dependencies - just plain TypeScript.
 */
import { ValidationResult, isString, isEmail, isPhone, isUUID, isBoolean, isArray, isObject } from './validate';

// ============================================
// Type Definitions
// ============================================

export interface LoginInput {
  email?: string;
  phone?: string;
  password: string;
}

export interface RegisterInput {
  name: string;
  email: string;
  phone?: string | null;
  password: string;
}

export interface ForgotPasswordInput {
  email?: string;
  phone?: string;
}

export interface ResetPasswordInput {
  id: string;
  password: string;
}

export interface ChangePasswordInput {
  current_password: string;
  new_password: string;
}

export interface CreateUserInput {
  name: string;
  email: string;
  phone?: string | null;
  password?: string;
  is_admin?: boolean;
  is_verified?: boolean;
}

export interface UpdateUserInput {
  name?: string;
  email?: string;
  phone?: string | null;
  password?: string;
  is_admin?: boolean;
  is_verified?: boolean;
}

export interface DeleteUsersInput {
  ids: string[];
}

export interface ChangeProfileInput {
  name: string;
  email: string;
  phone?: string | null;
}

export interface PaginationInput {
  page: number;
  limit: number;
  search: string;
  filter: 'all' | 'verified' | 'unverified';
}

// ============================================
// Validator Functions
// ============================================

/**
 * Login validator
 */
export function LoginSchema(data: unknown): ValidationResult<LoginInput> {
  const errors: Record<string, string[]> = {};
  
  if (!isObject(data)) {
    return { success: false, errors: { _root: ['Data harus berupa object'] } };
  }

  const { email, phone, password } = data as Record<string, unknown>;

  // Email or phone required
  if (!email && !phone) {
    errors._root = ['Email atau nomor telepon wajib diisi'];
  }

  // Validate email if provided
  if (email !== undefined && email !== null && email !== '') {
    if (!isEmail(email)) {
      errors.email = ['Format email tidak valid'];
    }
  }

  // Validate phone if provided
  if (phone !== undefined && phone !== null && phone !== '') {
    if (!isString(phone) || phone.length < 10) {
      errors.phone = ['Nomor telepon minimal 10 digit'];
    }
  }

  // Password required
  if (!isString(password) || password.length === 0) {
    errors.password = ['Password wajib diisi'];
  }

  if (Object.keys(errors).length > 0) {
    return { success: false, errors };
  }

  return {
    success: true,
    data: {
      email: email ? String(email).toLowerCase() : undefined,
      phone: phone ? String(phone) : undefined,
      password: String(password),
    }
  };
}

/**
 * Register validator
 */
export function RegisterSchema(data: unknown): ValidationResult<RegisterInput> {
  const errors: Record<string, string[]> = {};
  
  if (!isObject(data)) {
    return { success: false, errors: { _root: ['Data harus berupa object'] } };
  }

  const { name, email, phone, password } = data as Record<string, unknown>;

  // Name validation
  if (!isString(name) || name.trim().length < 2) {
    errors.name = ['Nama minimal 2 karakter'];
  } else if (name.length > 100) {
    errors.name = ['Nama maksimal 100 karakter'];
  }

  // Email validation
  if (!isEmail(email)) {
    errors.email = ['Format email tidak valid'];
  }

  // Phone validation (optional)
  if (phone !== undefined && phone !== null && phone !== '') {
    if (!isPhone(phone)) {
      errors.phone = ['Format nomor telepon tidak valid'];
    }
  }

  // Password validation
  if (!isString(password) || password.length < 8) {
    errors.password = ['Password minimal 8 karakter'];
  } else if (password.length > 100) {
    errors.password = ['Password maksimal 100 karakter'];
  }

  if (Object.keys(errors).length > 0) {
    return { success: false, errors };
  }

  return {
    success: true,
    data: {
      name: String(name).trim(),
      email: String(email).toLowerCase(),
      phone: phone ? String(phone) : null,
      password: String(password),
    }
  };
}

/**
 * Forgot password validator
 */
export function ForgotPasswordSchema(data: unknown): ValidationResult<ForgotPasswordInput> {
  const errors: Record<string, string[]> = {};
  
  if (!isObject(data)) {
    return { success: false, errors: { _root: ['Data harus berupa object'] } };
  }

  const { email, phone } = data as Record<string, unknown>;

  // Email or phone required
  if (!email && !phone) {
    errors._root = ['Email atau nomor telepon wajib diisi'];
  }

  // Validate email if provided
  if (email !== undefined && email !== null && email !== '') {
    if (!isEmail(email)) {
      errors.email = ['Format email tidak valid'];
    }
  }

  // Validate phone if provided
  if (phone !== undefined && phone !== null && phone !== '') {
    if (!isString(phone) || phone.length < 10) {
      errors.phone = ['Nomor telepon minimal 10 digit'];
    }
  }

  if (Object.keys(errors).length > 0) {
    return { success: false, errors };
  }

  return {
    success: true,
    data: {
      email: email ? String(email).toLowerCase() : undefined,
      phone: phone ? String(phone) : undefined,
    }
  };
}

/**
 * Reset password validator
 */
export function ResetPasswordSchema(data: unknown): ValidationResult<ResetPasswordInput> {
  const errors: Record<string, string[]> = {};
  
  if (!isObject(data)) {
    return { success: false, errors: { _root: ['Data harus berupa object'] } };
  }

  const { id, password } = data as Record<string, unknown>;

  // Token validation
  if (!isString(id) || id.length === 0) {
    errors.id = ['Token tidak valid'];
  }

  // Password validation
  if (!isString(password) || password.length < 8) {
    errors.password = ['Password minimal 8 karakter'];
  } else if (password.length > 100) {
    errors.password = ['Password maksimal 100 karakter'];
  }

  if (Object.keys(errors).length > 0) {
    return { success: false, errors };
  }

  return {
    success: true,
    data: {
      id: String(id),
      password: String(password),
    }
  };
}

/**
 * Change password validator
 */
export function ChangePasswordSchema(data: unknown): ValidationResult<ChangePasswordInput> {
  const errors: Record<string, string[]> = {};
  
  if (!isObject(data)) {
    return { success: false, errors: { _root: ['Data harus berupa object'] } };
  }

  const { current_password, new_password } = data as Record<string, unknown>;

  // Current password validation
  if (!isString(current_password) || current_password.length === 0) {
    errors.current_password = ['Password lama wajib diisi'];
  }

  // New password validation
  if (!isString(new_password) || new_password.length < 8) {
    errors.new_password = ['Password minimal 8 karakter'];
  } else if (new_password.length > 100) {
    errors.new_password = ['Password maksimal 100 karakter'];
  }

  if (Object.keys(errors).length > 0) {
    return { success: false, errors };
  }

  return {
    success: true,
    data: {
      current_password: String(current_password),
      new_password: String(new_password),
    }
  };
}

/**
 * Create user validator
 */
export function CreateUserSchema(data: unknown): ValidationResult<CreateUserInput> {
  const errors: Record<string, string[]> = {};
  
  if (!isObject(data)) {
    return { success: false, errors: { _root: ['Data harus berupa object'] } };
  }

  const { name, email, phone, password, is_admin, is_verified } = data as Record<string, unknown>;

  // Name validation
  if (!isString(name) || name.trim().length < 2) {
    errors.name = ['Nama minimal 2 karakter'];
  } else if (name.length > 100) {
    errors.name = ['Nama maksimal 100 karakter'];
  }

  // Email validation
  if (!isEmail(email)) {
    errors.email = ['Format email tidak valid'];
  }

  // Phone validation (optional)
  if (phone !== undefined && phone !== null && phone !== '') {
    if (!isPhone(phone)) {
      errors.phone = ['Format nomor telepon tidak valid'];
    }
  }

  // Password validation (optional)
  if (password !== undefined && password !== null && password !== '') {
    if (!isString(password) || password.length < 8) {
      errors.password = ['Password minimal 8 karakter'];
    }
  }

  if (Object.keys(errors).length > 0) {
    return { success: false, errors };
  }

  return {
    success: true,
    data: {
      name: String(name).trim(),
      email: String(email).toLowerCase(),
      phone: phone ? String(phone) : null,
      password: password ? String(password) : undefined,
      is_admin: isBoolean(is_admin) ? is_admin : false,
      is_verified: isBoolean(is_verified) ? is_verified : false,
    }
  };
}

/**
 * Update user validator
 */
export function UpdateUserSchema(data: unknown): ValidationResult<UpdateUserInput> {
  const errors: Record<string, string[]> = {};
  
  if (!isObject(data)) {
    return { success: false, errors: { _root: ['Data harus berupa object'] } };
  }

  const { name, email, phone, password, is_admin, is_verified } = data as Record<string, unknown>;

  // At least one field must be provided
  const hasAnyField = name !== undefined || email !== undefined || phone !== undefined || 
                      password !== undefined || is_admin !== undefined || is_verified !== undefined;
  
  if (!hasAnyField) {
    errors._root = ['Minimal satu field harus diisi untuk update'];
  }

  // Name validation (optional)
  if (name !== undefined && name !== null) {
    if (!isString(name) || name.trim().length < 2) {
      errors.name = ['Nama minimal 2 karakter'];
    } else if (name.length > 100) {
      errors.name = ['Nama maksimal 100 karakter'];
    }
  }

  // Email validation (optional)
  if (email !== undefined && email !== null) {
    if (!isEmail(email)) {
      errors.email = ['Format email tidak valid'];
    }
  }

  // Phone validation (optional)
  if (phone !== undefined && phone !== null && phone !== '') {
    if (!isPhone(phone)) {
      errors.phone = ['Format nomor telepon tidak valid'];
    }
  }

  // Password validation (optional)
  if (password !== undefined && password !== null && password !== '') {
    if (!isString(password) || password.length < 8) {
      errors.password = ['Password minimal 8 karakter'];
    }
  }

  if (Object.keys(errors).length > 0) {
    return { success: false, errors };
  }

  const result: UpdateUserInput = {};
  if (name !== undefined) result.name = String(name).trim();
  if (email !== undefined) result.email = String(email).toLowerCase();
  if (phone !== undefined) result.phone = phone ? String(phone) : null;
  if (password !== undefined && password !== '') result.password = String(password);
  if (is_admin !== undefined) result.is_admin = Boolean(is_admin);
  if (is_verified !== undefined) result.is_verified = Boolean(is_verified);

  return { success: true, data: result };
}

/**
 * Delete users validator
 */
export function DeleteUsersSchema(data: unknown): ValidationResult<DeleteUsersInput> {
  const errors: Record<string, string[]> = {};
  
  if (!isObject(data)) {
    return { success: false, errors: { _root: ['Data harus berupa object'] } };
  }

  const { ids } = data as Record<string, unknown>;

  // IDs validation
  if (!isArray(ids) || ids.length === 0) {
    errors.ids = ['Minimal satu ID harus dipilih'];
  } else {
    const invalidIds = ids.filter(id => !isUUID(id));
    if (invalidIds.length > 0) {
      errors.ids = ['Format ID tidak valid'];
    }
  }

  if (Object.keys(errors).length > 0) {
    return { success: false, errors };
  }

  return {
    success: true,
    data: {
      ids: (ids as unknown[]).map(id => String(id)),
    }
  };
}

/**
 * Change profile validator
 */
export function ChangeProfileSchema(data: unknown): ValidationResult<ChangeProfileInput> {
  const errors: Record<string, string[]> = {};
  
  if (!isObject(data)) {
    return { success: false, errors: { _root: ['Data harus berupa object'] } };
  }

  const { name, email, phone } = data as Record<string, unknown>;

  // Name validation
  if (!isString(name) || name.trim().length < 2) {
    errors.name = ['Nama minimal 2 karakter'];
  } else if (name.length > 100) {
    errors.name = ['Nama maksimal 100 karakter'];
  }

  // Email validation
  if (!isEmail(email)) {
    errors.email = ['Format email tidak valid'];
  }

  // Phone validation (optional)
  if (phone !== undefined && phone !== null && phone !== '') {
    if (!isPhone(phone)) {
      errors.phone = ['Format nomor telepon tidak valid'];
    }
  }

  if (Object.keys(errors).length > 0) {
    return { success: false, errors };
  }

  return {
    success: true,
    data: {
      name: String(name).trim(),
      email: String(email).toLowerCase(),
      phone: phone ? String(phone) : null,
    }
  };
}

/**
 * Pagination validator
 */
export function PaginationSchema(data: unknown): ValidationResult<PaginationInput> {
  if (!isObject(data)) {
    return {
      success: true,
      data: { page: 1, limit: 10, search: '', filter: 'all' }
    };
  }

  const { page, limit, search, filter } = data as Record<string, unknown>;

  const parsedPage = Number(page) || 1;
  const parsedLimit = Math.min(Number(limit) || 10, 100);
  const parsedSearch = isString(search) ? search : '';
  const validFilters = ['all', 'verified', 'unverified'] as const;
  const parsedFilter = validFilters.includes(filter as any) ? (filter as 'all' | 'verified' | 'unverified') : 'all';

  return {
    success: true,
    data: {
      page: Math.max(1, parsedPage),
      limit: Math.max(1, parsedLimit),
      search: parsedSearch,
      filter: parsedFilter,
    }
  };
}

// ============================================
// Legacy exports for backward compatibility
// ============================================

export const EmailSchema = (value: unknown) => isEmail(value);
export const PasswordSchema = (value: unknown) => isString(value) && value.length >= 8 && value.length <= 100;
export const PhoneSchema = (value: unknown) => value === undefined || value === null || value === '' || isPhone(value);
export const NameSchema = (value: unknown) => isString(value) && value.trim().length >= 2 && value.length <= 100;
export const UUIDSchema = (value: unknown) => isUUID(value);
