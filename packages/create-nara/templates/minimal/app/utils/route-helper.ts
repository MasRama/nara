import { ValidationError, jsonValidationError, jsonError } from '@nara-web/core';
import type { NaraRequest, NaraResponse } from '@nara-web/core';

type AsyncHandler = (req: NaraRequest, res: NaraResponse) => Promise<any> | any;

/**
 * Wraps a route handler with error handling
 */
export function wrapHandler(handler: AsyncHandler): any {
  return async (req: NaraRequest, res: NaraResponse) => {
    try {
      await handler(req, res);
    } catch (error: any) {
      if (error instanceof ValidationError) {
        jsonValidationError(res, error.errors);
        return;
      }

      // Handle other HttpErrors
      if (error.statusCode) {
        jsonError(res, error.message, error.statusCode);
        return;
      }

      // Unknown error
      console.error('[Unhandled Error]:', error);
      jsonError(res, 'Internal server error', 500);
    }
  };
}
