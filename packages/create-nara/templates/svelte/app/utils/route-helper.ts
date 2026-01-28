import { ValidationError, jsonValidationError, jsonError } from '@nara-web/core';
import type { NaraRequest, NaraResponse, NaraHandler } from '@nara-web/core';

/**
 * Wraps a route handler with error handling
 */
export function wrapHandler(handler: NaraHandler): NaraHandler {
  return async (req: NaraRequest, res: NaraResponse) => {
    try {
      await handler(req, res);
    } catch (error: any) {
      if (error instanceof ValidationError) {
        return jsonValidationError(res, error.errors);
      }

      // Handle other HttpErrors
      if (error.statusCode) {
        return jsonError(res, error.message, error.statusCode);
      }

      // Unknown error
      console.error('[Unhandled Error]:', error);
      return jsonError(res, 'Internal server error', 500);
    }
  };
}
