/**
 * Validation Helper
 * 
 * Utility function to validate request data using Zod schemas.
 * Returns formatted error messages for invalid data.
 */
import { z, ZodError, ZodSchema } from 'zod';
import { Response } from '@type';

/**
 * Validation result type
 */
export type ValidationResult<T> = 
  | { success: true; data: T }
  | { success: false; errors: Record<string, string[]> };

/**
 * Validate data against a Zod schema
 * @param schema - Zod schema to validate against
 * @param data - Data to validate
 * @returns Validation result with parsed data or errors
 */
export function validate<T>(schema: ZodSchema<T>, data: unknown): ValidationResult<T> {
  try {
    const parsed = schema.parse(data);
    return { success: true, data: parsed };
  } catch (error) {
    if (error instanceof ZodError) {
      const errors: Record<string, string[]> = {};
      
      for (const issue of error.issues) {
        const path = issue.path.join('.') || '_root';
        if (!errors[path]) {
          errors[path] = [];
        }
        errors[path].push(issue.message);
      }
      
      return { success: false, errors };
    }
    throw error;
  }
}

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
 * @param response - HyperExpress response object
 * @param errors - Validation errors
 * @returns Response with 400 status and error details
 */
export function sendValidationError(response: Response, errors: Record<string, string[]>) {
  return response.status(400).json({
    success: false,
    message: 'Validation failed',
    errors,
  });
}

/**
 * Validate and return data or send error response
 * Helper that combines validation and error response
 * @param schema - Zod schema
 * @param data - Data to validate
 * @param response - Response object for error handling
 * @returns Parsed data or null if validation failed (response already sent)
 */
export async function validateOrFail<T>(
  schema: ZodSchema<T>,
  data: unknown,
  response: Response
): Promise<T | null> {
  const result = validate(schema, data);
  
  if (!result.success) {
    sendValidationError(response, result.errors);
    return null;
  }
  
  return result.data;
}
