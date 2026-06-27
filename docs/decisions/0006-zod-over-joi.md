# ADR 0006: Zod over Joi for validation

Date: 2025-01-15
Status: Accepted

## Context

Input validation is needed for all handler inputs. Options:
- **Zod** — TypeScript-first, infers types from schemas
- **Joi** — schema-based, separate types needed
- **Yup** — similar to Joi, lighter
- **class-validator** — decorator-based, requires classes (violates ADR 0002)

## Decision

Use Zod for all input validation:
- Schemas in `app/validators/schemas.ts`
- `zodToErrors()` helper converts Zod errors to `Record<string, string[]>` for `jsonValidationError()`
- Types inferred via `z.infer<typeof Schema>` — no duplicate type definitions

## Consequences

Positive:
- Single source of truth — schema IS the type, no manual interfaces
- AI writes one definition, gets both runtime validation and TypeScript types
- Excellent TypeScript inference — `safeParse()` returns typed data
- Composable — `z.object().extend().omit().partial()` for variations

Negative:
- Zod v4 has some breaking changes from v3 — pinned to v4
- Bundle size larger than Yup — acceptable for server-side

## Alternatives considered

- **Joi** — mature, but requires separate TypeScript types. AI must keep two definitions in sync.
- **Yup** — lighter, but same dual-definition problem as Joi.
- **class-validator** — decorator-based, requires classes (violates ADR 0002).
- **valibot** — smaller than Zod, similar API. Good alternative, but Zod has better AI training data coverage.
