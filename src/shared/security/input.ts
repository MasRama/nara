import { z } from 'zod';

/**
 * v2's global HTML-stripping sanitizer is intentionally not ported: mutating
 * arbitrary business input corrupts legitimate data and Vue's default
 * interpolation already escapes rendered text. The restored contract is
 * validate-then-normalize at the owning Feature schema:
 *
 * - trim surrounding whitespace (names, emails, slugs)
 * - normalize email case (existing lowercase transform, preserved)
 * - reject control/null bytes that have no legitimate business meaning
 * - bound string lengths (existing min/max, preserved)
 *
 * Passwords are never trimmed or transformed, only length-bounded.
 * Prototype pollution needs no separate filter: schemas are strict Zod
 * objects that discard unknown keys, and request data is never recursively
 * merged into prototypes (covered by security tests).
 */
function noControlChars(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code <= 31 || code === 127) return false;
  }
  return true;
}

const CONTROL_MESSAGE = 'must not contain control characters';

export const personNameSchema = z
  .string()
  .trim()
  .min(2, 'Name must be at least 2 characters')
  .max(100)
  .refine(noControlChars, { message: `Name ${CONTROL_MESSAGE}` });

export const emailSchema = z
  .string()
  .trim()
  .email('Invalid email format')
  .refine(noControlChars, { message: `Email ${CONTROL_MESSAGE}` })
  .transform((value) => value.toLowerCase());

export const roleNameSchema = z
  .string()
  .trim()
  .min(2, 'Role name must be at least 2 characters')
  .max(100, 'Role name must be at most 100 characters')
  .refine(noControlChars, { message: `Role name ${CONTROL_MESSAGE}` });

export const roleSlugSchema = z
  .string()
  .trim()
  .min(2, 'Slug must be at least 2 characters')
  .max(100, 'Slug must be at most 100 characters')
  .regex(/^[a-z0-9-]+$/, 'Slug may only contain lowercase letters, numbers, and hyphens')
  .refine(noControlChars, { message: `Slug ${CONTROL_MESSAGE}` })
  .transform((value) => value.toLowerCase());

export const roleDescriptionSchema = z
  .string()
  .trim()
  .max(500, 'Description must be at most 500 characters')
  .refine(noControlChars, { message: `Description ${CONTROL_MESSAGE}` })
  .nullable()
  .optional();
