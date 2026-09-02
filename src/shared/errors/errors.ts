export type ErrorKind = 'application' | 'validation';

export type ApplicationError = Error & {
  kind: 'application';
  status: number;
  code?: string;
};

export type ValidationError = Error & {
  kind: 'validation';
  errors: Record<string, string[]>;
  code: 'VALIDATION_ERROR';
};

export function createApplicationError(
  message: string,
  status = 400,
  code?: string,
): ApplicationError {
  const error = Object.assign(new Error(message), {
    kind: 'application' as const,
    status,
    ...(code ? { code } : {}),
  });
  return error;
}

export function createValidationError(
  errors: Record<string, string[]>,
  message = 'Validation failed',
): ValidationError {
  return Object.assign(new Error(message), {
    kind: 'validation' as const,
    errors,
    code: 'VALIDATION_ERROR' as const,
  });
}

export function isApplicationError(error: unknown): error is ApplicationError {
  return error instanceof Error && 'kind' in error && error.kind === 'application';
}

export function isValidationError(error: unknown): error is ValidationError {
  return error instanceof Error && 'kind' in error && error.kind === 'validation';
}
