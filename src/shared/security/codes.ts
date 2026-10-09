/**
 * Refusal codes any `/api` route can answer with, whichever Feature owns it:
 * the shared guards and input validation, and the application pipeline ahead
 * of every route (CSRF, rate and body limits, the error handler, and the
 * password-change gate an Auth provider mounts). A Feature's contract adds its
 * own codes to these; the UI branches only on declared codes.
 *
 * Kept free of imports: contracts reach the browser bundle.
 */
export const API_REFUSAL_CODES = [
  'UNAUTHORIZED',
  'FORBIDDEN',
  'VALIDATION_ERROR',
  'CSRF_INVALID',
  'RATE_LIMITED',
  'PAYLOAD_TOO_LARGE',
  'PASSWORD_CHANGE_REQUIRED',
  'APPLICATION_ERROR',
  'INTERNAL_ERROR',
] as const;

export type ApiRefusalCode = (typeof API_REFUSAL_CODES)[number];
