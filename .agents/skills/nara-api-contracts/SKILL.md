---
name: nara-api-contracts
description: Writing Hono routes that return JSON, handling errors, or writing validation
---

# API Contracts & Error Handling

## Response shapes

Feature JSON endpoints use a discriminated response shape:

```typescript
// Success
{ success: true, message: string, data?: T }

// Error
{ success: false, message: string, code: string, errors?: Record<string, string[]> }
```

Keep messages in English (ADR 0010). Define request and response types with the owning Feature's `contract.ts`.

## Runtime validation

Validate request data at the route boundary with the Feature's Zod schema:

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

Use `safeParse()` for expected client input. Do not expose stack traces, SQL, password hashes, or other internal details.

## Hono route responses

Return responses directly from the owning Feature's Hono route module:

```typescript
const currentUserHandler = (context: Context) => {
  const user = currentUser(getCookie(context, SESSION_COOKIE_NAME));
  if (!user) {
    return context.json(
      { success: false as const, message: 'Unauthorized', code: 'UNAUTHORIZED' },
      401,
    );
  }
  return context.json({ success: true as const, message: 'OK', data: { user } });
};
```

Use the correct HTTP status for the contract: `401` for missing authentication, `403` for missing permission, `404` for absent resources, `409` for conflicts, and `422` for validation failures.

## Error propagation

Expected domain failures may use `createApplicationError()` or `createValidationError()` from `src/shared/errors`. `src/app/error-handler.ts` maps those errors to the public JSON shape. Do not catch errors merely to rethrow them or duplicate the global handler.

```typescript
throw createApplicationError('Role not found', 404, 'NOT_FOUND');
```

Catch only when the Feature can add meaningful behavior, such as translating a known SQLite uniqueness constraint into a stable response code. Log unexpected failures through `src/shared/logging`; never use `console.log`.

## Feature-scoped frontend consumption

Use the typed client owned by the Feature's `web/` directory:

```typescript
const result = await authClient.login({ email, password });
if (!result.success) {
  errorMessage.value = result.message;
}
```

Vue pages and Feature-owned composables handle loading, validation, and error display. Do not use server-rendered page props, Inertia transport, a global RPC type, or a second frontend framework.

## Do / Don't

- **Do** keep schemas, inferred types, routes, and typed clients Feature-scoped.
- **Do** return `context.json()` with literal `success` discriminants.
- **Do** validate all external input at the Hono boundary.
- **Do** preserve stable error codes for client behavior and tests.
- **Do** use the app-level error handler for unexpected failures.
- **Don't** import another Feature's server internals from web code.
- **Don't** duplicate request/response interfaces in Vue pages.
- **Don't** expose internal errors or sensitive fields.
- **Don't** create a global transport or response abstraction.
