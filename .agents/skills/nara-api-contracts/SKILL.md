---
name: nara-api-contracts
description: Writing Hono routes that return JSON, handling errors, or writing validation
---

# API Contracts & Error Handling

How to write a Hono handler, validate at the boundary, and return the
stable JSON shape. Feature-owned request/response types live in the
owning Feature's `contract.ts`.

## Response shapes

Feature JSON endpoints use a discriminated response shape:

```typescript
// Success
{ success: true, message: string, data?: T }

// Error
{ success: false, message: string, code: string, errors?: Record<string, string[]> }
```

Keep messages in English (ADR 0010). Return responses with `context.json()`
and literal `success` discriminants directly from the owning Feature's Hono
route module. Use the correct HTTP status: `401` missing authentication,
`403` missing permission, `404` absent resource, `409` conflict, `422`
validation failure.

## Runtime validation

Validate request data at the route boundary with the Feature's Zod schema.
Route modules keep small local `requestBody` / `validationErrors` helpers
(see `src/features/auth/server/routes.ts` for the reference shape):

```typescript
const parsed = loginInputSchema.safeParse(await requestBody(context));
if (!parsed.success) {
  return context.json(
    {
      success: false as const,
      message: 'Validation failed',
      code: 'VALIDATION_ERROR',
      errors: validationErrors(parsed.error),
    },
    422,
  );
}
```

Use `safeParse()` for expected client input. Do not expose stack traces,
SQL, password hashes, or other internal details.

## Error propagation

Expected domain failures use `createApplicationError()` or
`createValidationError()` from `src/shared/errors`:

```typescript
throw createApplicationError('Role not found', 404, 'NOT_FOUND');
```

`src/app/error-handler.ts` maps those errors to the public JSON shape, so
do not catch errors merely to rethrow them or duplicate the global
handler. Catch only when the Feature adds meaningful behavior, such as
translating a known SQLite uniqueness constraint into a stable response
code. Log unexpected failures through `src/shared/logging`; never use
`console.log`.

## Feature-scoped frontend consumption

Consume through the typed client owned by the Feature's `web/` directory:

```typescript
const result = await authClient.login({ email, password });
if (!result.success) {
  errorMessage.value = result.message;
}
```

Vue pages and Feature-owned composables handle loading, validation, and
error display. Preserve stable error codes — clients and tests depend on
them.

## Do / Don't

- **Do** keep schemas, inferred types, routes, and typed clients Feature-scoped.
- **Do** validate all external input at the Hono boundary.
- **Do** preserve stable error codes for client behavior and tests.
- **Don't** duplicate request/response interfaces in Vue pages.
- **Don't** expose internal errors or sensitive fields.
- **Don't** create a global transport or response abstraction.
