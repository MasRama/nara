import type { NaraRequest, NaraResponse } from '@core';
import { getUserBySessionId } from '@queries';

export const landingPage = (req: NaraRequest, res: NaraResponse) => {
  let user = {};

  if (req.cookies.auth_id) {
    const found = getUserBySessionId(req.cookies.auth_id);
    if (found) user = found;
  }

  return res.inertia('landing', { user });
};
