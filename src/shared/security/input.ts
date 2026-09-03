import { z } from 'zod';

/**
 * v2's global HTML-stripping sanitizer is intentionally not ported: mutating
 * arbitrary business input corrupts legitimate data and Vue's default
 * interpolation already escapes rendered text. The restored contract is
 * validate-then-normalize at the owning Feature schema.
 *
 * Shared code owns only feature-neutral primitives: the control-byte check
 * plus the genuinely generic person/email schemas reused by auth and users.
 * Domain validation (roles, slugs, descriptions) lives in the owning Feature
 * contract and composes this primitive; it is not duplicated here.
 *
 * Passwords are never trimmed or transformed, only length-bounded.
 * Prototype pollution needs no separate filter: schemas are strict Zod
 * objects that discard unknown keys, and request data is never recursively
 * merged into prototypes (covered by security tests).
 */
export function hasNoControlChars(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code <= 31 || code === 127) return false;
  }
  return true;
}

export const CONTROL_MESSAGE = 'must not contain control characters';

export const personNameSchema = z
  .string()
  .trim()
  .min(2, 'Name must be at least 2 characters')
  .max(100)
  .refine(hasNoControlChars, { message: `Name ${CONTROL_MESSAGE}` });

export const emailSchema = z
  .string()
  .trim()
  .email('Invalid email format')
  .refine(hasNoControlChars, { message: `Email ${CONTROL_MESSAGE}` })
  .transform((value) => value.toLowerCase());
