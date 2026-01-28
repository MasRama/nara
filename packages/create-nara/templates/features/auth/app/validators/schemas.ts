/**
 * Validation Schemas
 *
 * Simple validation functions for all API endpoints.
 * No external dependencies - just plain TypeScript.
 */
import { ValidationResult, isString, isEmail, isPhone, isUUID, isBoolean, isArray, isObject } from './validate.js';

// ============================================
// Type Definitions
// ============================================

export interface LoginInput {
  email: string;
  password: string;
}

export interface RegisterInput {
  name: string;
  email: string;
  phone?: string | null;
  password: string;
}

export interface ForgotPasswordInput {
  email: string;
}

export interface ResetPasswordInput {
  token: string;
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
  role?: string;
}

export interface UpdateUserInput {
  name?: string;
  email?: string;
  phone?: string | null;
  password?: string;
  role?: string;
}

export interface DeleteUsersInput {
  ids: string[];
}

export interface ChangeProfileInput {
  name: string;
  email: string;
  phone?: string | null;
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
    return { success: false, errors: { _root: ['Data must be an object'] } };
  }

  const { email, password } = data as Record<string, unknown>;

  // Email validation
  if (!email || !isEmail(email)) {
    errors.email = ['Valid email is required'];
  }

  // Password validation
  if (!isString(password) || password.length === 0) {
    errors.password = ['Password is required'];
  }

  if (Object.keys(errors).length > 0) {
    return { success: false, errors };
  }

  return {
    success: true,
    data: {
      email: String(email).trim().toLowerCase(),
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
    return { success: false, errors: { _root: ['Data must be an object'] } };
  }

  const { name, email, phone, password } = data as Record<string, unknown>;

  // Name validation
  if (!isString(name) || name.trim().length < 2) {
    errors.name = ['Name must be at least 2 characters'];
  } else if (name.length > 100) {
    errors.name = ['Name must be at most 100 characters'];
  }

  // Email validation
  if (!isEmail(email)) {
    errors.email = ['Valid email is required'];
  }

  // Phone validation (optional)
  if (phone !== undefined && phone !== null && phone !== '') {
    if (!isPhone(phone)) {
      errors.phone = ['Invalid phone number format'];
    }
  }

  // Password validation
  if (!isString(password) || password.length < 8) {
    errors.password = ['Password must be at least 8 characters'];
  } else if (password.length > 100) {
    errors.password = ['Password must be at most 100 characters'];
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
    return { success: false, errors: { _root: ['Data must be an object'] } };
  }

  const { email } = data as Record<string, unknown>;

  if (!isEmail(email)) {
    errors.email = ['Valid email is required'];
  }

  if (Object.keys(errors).length > 0) {
    return { success: false, errors };
  }

  return {
    success: true,
    data: {
      email: String(email).toLowerCase(),
    }
  };
}

/**
 * Reset password validator
 */
export function ResetPasswordSchema(data: unknown): ValidationResult<ResetPasswordInput> {
  const errors: Record<string, string[]> = {};

  if (!isObject(data)) {
    return { success: false, errors: { _root: ['Data must be an object'] } };
  }

  const { token, password } = data as Record<string, unknown>;

  // Token validation
  if (!isString(token) || token.length === 0) {
    errors.token = ['Reset token is required'];
  }

  // Password validation
  if (!isString(password) || password.length < 8) {
    errors.password = ['Password must be at least 8 characters'];
  } else if (password.length > 100) {
    errors.password = ['Password must be at most 100 characters'];
  }

  if (Object.keys(errors).length > 0) {
    return { success: false, errors };
  }

  return {
    success: true,
    data: {
      token: String(token),
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
    return { success: false, errors: { _root: ['Data must be an object'] } };
  }

  const { current_password, new_password } = data as Record<string, unknown>;

  // Current password validation
  if (!isString(current_password) || current_password.length === 0) {
    errors.current_password = ['Current password is required'];
  }

  // New password validation
  if (!isString(new_password) || new_password.length < 8) {
    errors.new_password = ['New password must be at least 8 characters'];
  } else if (new_password.length > 100) {
    errors.new_password = ['New password must be at most 100 characters'];
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
    return { success: false, errors: { _root: ['Data must be an object'] } };
  }

  const { name, email, phone, password, role } = data as Record<string, unknown>;

  // Name validation
  if (!isString(name) || name.trim().length < 2) {
    errors.name = ['Name must be at least 2 characters'];
  } else if (name.length > 100) {
    errors.name = ['Name must be at most 100 characters'];
  }

  // Email validation
  if (!isEmail(email)) {
    errors.email = ['Valid email is required'];
  }

  // Phone validation (optional)
  if (phone !== undefined && phone !== null && phone !== '') {
    if (!isPhone(phone)) {
      errors.phone = ['Invalid phone number format'];
    }
  }

  // Password validation (optional)
  if (password !== undefined && password !== null && password !== '') {
    if (!isString(password) || password.length < 8) {
      errors.password = ['Password must be at least 8 characters'];
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
      role: isString(role) ? role : 'user',
    }
  };
}

/**
 * Update user validator
 */
export function UpdateUserSchema(data: unknown): ValidationResult<UpdateUserInput> {
  const errors: Record<string, string[]> = {};

  if (!isObject(data)) {
    return { success: false, errors: { _root: ['Data must be an object'] } };
  }

  const { name, email, phone, password, role } = data as Record<string, unknown>;

  // At least one field must be provided
  const hasAnyField = name !== undefined || email !== undefined || phone !== undefined ||
                      password !== undefined || role !== undefined;

  if (!hasAnyField) {
    errors._root = ['At least one field is required for update'];
  }

  // Name validation (optional)
  if (name !== undefined && name !== null) {
    if (!isString(name) || name.trim().length < 2) {
      errors.name = ['Name must be at least 2 characters'];
    } else if (name.length > 100) {
      errors.name = ['Name must be at most 100 characters'];
    }
  }

  // Email validation (optional)
  if (email !== undefined && email !== null) {
    if (!isEmail(email)) {
      errors.email = ['Valid email is required'];
    }
  }

  // Phone validation (optional)
  if (phone !== undefined && phone !== null && phone !== '') {
    if (!isPhone(phone)) {
      errors.phone = ['Invalid phone number format'];
    }
  }

  // Password validation (optional)
  if (password !== undefined && password !== null && password !== '') {
    if (!isString(password) || password.length < 8) {
      errors.password = ['Password must be at least 8 characters'];
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
  if (role !== undefined) result.role = String(role);

  return { success: true, data: result };
}

/**
 * Delete users validator
 */
export function DeleteUsersSchema(data: unknown): ValidationResult<DeleteUsersInput> {
  const errors: Record<string, string[]> = {};

  if (!isObject(data)) {
    return { success: false, errors: { _root: ['Data must be an object'] } };
  }

  const { ids } = data as Record<string, unknown>;

  // IDs validation
  if (!isArray(ids) || ids.length === 0) {
    errors.ids = ['At least one ID is required'];
  } else {
    const invalidIds = ids.filter(id => !isUUID(id));
    if (invalidIds.length > 0) {
      errors.ids = ['Invalid ID format'];
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
    return { success: false, errors: { _root: ['Data must be an object'] } };
  }

  const { name, email, phone } = data as Record<string, unknown>;

  // Name validation
  if (!isString(name) || name.trim().length < 2) {
    errors.name = ['Name must be at least 2 characters'];
  } else if (name.length > 100) {
    errors.name = ['Name must be at most 100 characters'];
  }

  // Email validation
  if (!isEmail(email)) {
    errors.email = ['Valid email is required'];
  }

  // Phone validation (optional)
  if (phone !== undefined && phone !== null && phone !== '') {
    if (!isPhone(phone)) {
      errors.phone = ['Invalid phone number format'];
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
