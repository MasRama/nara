/**
 * Validators Module
 * 
 * Re-exports all validation schemas and utilities.
 */

// Validation utilities
export { validate, validateOrFail, formatErrors, sendValidationError } from './validate';
export type { ValidationResult } from './validate';

// All schemas
export {
  // Common
  EmailSchema,
  PasswordSchema,
  PhoneSchema,
  NameSchema,
  UUIDSchema,
  
  // Auth
  LoginSchema,
  RegisterSchema,
  ForgotPasswordSchema,
  ResetPasswordSchema,
  ChangePasswordSchema,
  
  // User
  CreateUserSchema,
  UpdateUserSchema,
  DeleteUsersSchema,
  ChangeProfileSchema,
  
  // Pagination
  PaginationSchema,
} from './schemas';

// Type exports
export type {
  LoginInput,
  RegisterInput,
  ForgotPasswordInput,
  ResetPasswordInput,
  ChangePasswordInput,
  CreateUserInput,
  UpdateUserInput,
  DeleteUsersInput,
  ChangeProfileInput,
  PaginationInput,
} from './schemas';
