import type { NaraRequest, NaraResponse } from '@core';
import { jsonSuccess, jsonError } from '@core';
import { pingDatabase } from '@queries';

export const healthCheck = (_req: NaraRequest, res: NaraResponse) => {
  return jsonSuccess(res, 'OK');
};

export const readyCheck = (_req: NaraRequest, res: NaraResponse) => {
  if (!pingDatabase()) {
    return jsonError(res, 'Database unavailable', 503, 'DB_UNAVAILABLE');
  }
  return jsonSuccess(res, 'OK');
};
