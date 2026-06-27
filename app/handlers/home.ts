import type { NaraRequest, NaraResponse } from '@core';
import { findSessionById, findUserById } from '@queries';

export const index = (req: NaraRequest, res: NaraResponse) => {
  let user = {};

  if (req.cookies.auth_id) {
    const session = findSessionById(req.cookies.auth_id);
    if (session) {
      const found = findUserById(session.user_id);
      if (found) user = found;
    }
  }

  return res.inertia('landing', { user });
};
