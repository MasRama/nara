---
name: nara-api-contracts
description: Writing Hono routes that return JSON, handling errors, or writing validation
---

# API Contracts & Error Handling

How to write a Hono handler, validate at the boundary, and return the
stable JSON shape. Feature-owned request/response types live in the
owning Feature's `contract.ts`.

## Response shapes

Business Feature JSON endpoints under `/api/*` use a discriminated response
shape. Operational probes such as `/health` and `/ready` intentionally use
their smaller probe-specific payloads instead:

```typescript
// Success
{ success: true, message: string, data?: T }

// Error
{ success: false, message: string, code: string, errors?: Record<string, string[]> }
```

Keep messages in English (ADR 0010). Return business API responses with
`context.json()` and literal `success` discriminants directly from the owning
Feature's Hono route module. Use the correct HTTP status: `401` missing
authentication, `403` missing permission, `404` absent resource, `409`
resource/state conflict, `422` validation failure.

## Runtime validation

Validate structured client input at the route boundary with the owning
Feature's Zod schema. JSON body routes commonly keep small local `requestBody`
/ `validationErrors` helpers (see `src/features/auth/server/routes.ts` for the
reference shape):

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

Use `safeParse()` for expected structured client input. File-upload routes may
parse multipart data first and then validate the Feature-owned file metadata,
size, and content rules explicitly. Path/query values still need explicit
parsing, normalization, bounds, or schemas before use. Do not expose stack
traces, SQL, password hashes, or other internal details.

## Error propagation

In the reference application, expected failures that should propagate through
the app-level handler may use `createApplicationError()` or
`createValidationError()` from `src/shared/errors`:

```typescript
throw createApplicationError('Role not found', 404, 'NOT_FOUND');
```

`src/app/error-handler.ts` maps those reference-app errors to the public JSON
shape. A route may also return an expected public failure directly when that
is clearer. Do not catch errors merely to rethrow them or duplicate the global
handler; catch when the Feature adds meaningful behavior, such as translating
a known SQLite uniqueness constraint into a stable `409` response code.

Installable Features cannot assume reference-only shared modules such as
`src/shared/errors` or `src/shared/logging` exist in every host. They should
own the small behavior they need or declare a typed host requirement when the
behavior is application-specific. Reference-app code logs unexpected failures
through `src/shared/logging`; never use `console.log` for application logging.

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
- **Do** validate or explicitly normalize all external input at the Hono boundary.
- **Do** preserve stable error codes for client behavior and tests.
- **Don't** duplicate request/response interfaces in Vue pages.
- **Don't** expose internal errors or sensitive fields.
- **Don't** create a global transport or response abstraction.
