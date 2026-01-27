import type { NaraResponse } from './types';

export function jsonSuccess(res: NaraResponse, data: any, message = 'Success') {
  return res.json({ success: true, message, data });
}

export function jsonError(res: NaraResponse, message: string, status = 400) {
  return res.status(status).json({ success: false, message });
}

export function jsonNotFound(res: NaraResponse, message = 'Not found') {
  return res.status(404).json({ success: false, message });
}

export function jsonUnauthorized(res: NaraResponse, message = 'Unauthorized') {
  return res.status(401).json({ success: false, message });
}

export function jsonForbidden(res: NaraResponse, message = 'Forbidden') {
  return res.status(403).json({ success: false, message });
}

export function jsonValidationError(res: NaraResponse, errors: Record<string, string[]>) {
  return res.status(422).json({ success: false, message: 'Validation failed', errors });
}
