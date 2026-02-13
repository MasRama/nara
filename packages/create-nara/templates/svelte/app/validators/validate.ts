/**
 * Validation Helper
 * 
 * Simple validation utilities without external dependencies.
 * Returns formatted error messages for invalid data.
 */
import type { NaraResponse as Response } from '@core';
import { jsonValidationError } from '@core';

/**
 * Validation result type
 */
export type ValidationResult<T> = 
  | { success: true; data: T }
  | { success: false; errors: Record<string, string[]> };

/**
 * Validator function type
 */
export type Validator<T> = (data: unknown) => ValidationResult<T>;

/**
 * Format validation errors into a single message string
 * @param errors - Validation errors object
 * @returns Formatted error message
 */
export function formatErrors(errors: Record<string, string[]>): string {
  const messages: string[] = [];
  
  for (const [field, fieldErrors] of Object.entries(errors)) {
    if (field === '_root') {
      messages.push(...fieldErrors);
    } else {
      messages.push(`${field}: ${fieldErrors.join(', ')}`);
    }
  }
  
  return messages.join('; ');
}

/**
 * Send validation error response
 * @param response - Response object
 * @param errors - Validation errors
 * @returns Response with 422 status and error details
 */
export function sendValidationError(response: Response, errors: Record<string, string[]>) {
  return jsonValidationError(response as any, 'Validation failed', errors);
}

/**
 * Validate and return data or send error response
 * Helper that combines validation and error response
 * @param validator - Validator function
 * @param data - Data to validate
 * @param response - Response object for error handling
 * @returns Parsed data or null if validation failed (response already sent)
 */
export async function validateOrFail<T>(
  validator: Validator<T>,
  data: unknown,
  response: Response
): Promise<T | null> {
  const result = validator(data);
  
  if (!result.success) {
    sendValidationError(response, result.errors);
    return null;
  }
  
  return result.data;
}

// ============================================
// Validation Helpers
// ============================================

/**
 * Check if value is a non-empty string
 */
export function isString(value: unknown): value is string {
  return typeof value === 'string';
}

/**
 * Check if value is a valid email
 */
export function isEmail(value: unknown): boolean {
  if (!isString(value)) return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(value);
}

/**
 * Check if value is a valid phone number
 */
export function isPhone(value: unknown): boolean {
  if (!isString(value)) return false;
  const phoneRegex = /^[0-9+\-\s()]+$/;
  return phoneRegex.test(value) && value.length >= 10 && value.length <= 20;
}

/**
 * Check if value is a valid UUID
 */
export function isUUID(value: unknown): boolean {
  if (!isString(value)) return false;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(value);
}

/**
 * Check if value is a number
 */
export function isNumber(value: unknown): value is number {
  return typeof value === 'number' && !isNaN(value);
}

/**
 * Check if value is a boolean
 */
export function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean';
}

/**
 * Check if value is an array
 */
export function isArray(value: unknown): value is unknown[] {
  return Array.isArray(value);
}

/**
 * Check if value is an object
 */
export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
