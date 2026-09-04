import type { ErrorHandler } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { env } from '../shared/config';
import { isApplicationError, isValidationError } from '../shared/errors';
import { Logger } from '../shared/logging';
import { getRequestId } from './observability';
export const handleError: ErrorHandler = (error, context) => {
  // Thrown errors bypass middleware unwinding, so stamp the request ID here
  // for 500 correlation; the response header alone is sufficient publicly.
  const requestId = getRequestId(context);
  if (requestId) context.header('X-Request-Id', requestId);
  if (error instanceof HTTPException) {
    return context.json(
      {
        success: false as const,
        message: error.message,
        code: 'APPLICATION_ERROR',
      },
      error.status,
    );
  }

  if (isValidationError(error)) {
    return context.json(
      {
        success: false as const,
        message: error.message,
        code: error.code,
        errors: error.errors,
      },
      422,
    );
  }

  if (isApplicationError(error)) {
    return context.json(
      {
        success: false as const,
        message: error.message,
        ...(error.code ? { code: error.code } : {}),
      },
      error.status as 400,
    );
  }

  Logger.error('Unhandled application error', {
    requestId,
    method: context.req.method,
    path: new URL(context.req.url).pathname,
    ...(error instanceof Error ? { err: error } : { error: String(error) }),
  });

  return context.json(
    {
      success: false as const,
      message: env.NODE_ENV === 'development' && error instanceof Error
        ? error.message
        : 'Internal Server Error',
      code: 'INTERNAL_ERROR',
    },
    500,
  );
};
