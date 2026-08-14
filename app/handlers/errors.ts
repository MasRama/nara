import type { NaraRequest, NaraResponse } from '@core';

export const notFoundPage = (_req: NaraRequest, res: NaraResponse) => {
  res.status(404);
  return res.inertia('errors/NotFound');
};
