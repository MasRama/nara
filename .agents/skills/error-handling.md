---
authority: canon
last_verified: 2026-06-28
trigger: Writing error handling in handlers or services, or debugging error flow
---

# Error Handling

> **Authority:** canon — current source of truth for error handling patterns.

## When to use

Any time you write a handler that can fail, or a service that can throw.

## Two Patterns — Pick Based on Context

### Pattern 1: Handlers — return jsonError directly (preferred)

```typescript
import { jsonError, jsonForbidden, jsonNotFound, jsonUnauthorized, jsonValidationError, jsonServerError } from '@core';

export const show = (req: NaraRequest, res: NaraResponse) => {
  if (!req.user) return jsonError(res, 'Unauthorized', 401);
  const user = findUserById(req.params.id);
  if (!user) return jsonNotFound(res, 'User not found');
  return jsonSuccess(res, 'OK', user);
};
```

Use this in handlers where you want explicit control flow. The handler decides what error to return and stops execution with `return`.

### Pattern 2: Deep Services — throw NaraError (bubbles to global handler)

```typescript
import { notFoundError, forbiddenError, authError, badRequestError, conflictError, tooManyRequestsError, internalError, validationError } from '@core';

throw notFoundError('User not found');       // 404
throw forbiddenError();                       // 403
throw authError();                            // 401
throw badRequestError('Invalid input');       // 400
throw conflictError('Email exists');          // 409
throw tooManyRequestsError('Slow down', 60);  // 429 + retryAfter
throw internalError('Something broke');       // 500
throw validationError({ email: ['Email already exists'] }); // 422
```

Use this in services or shared functions where the caller is not always a handler (e.g. a query function used by multiple handlers). The error bubbles to the global error handler in `App.ts` which formats it as a JSON response.

## Response Helpers (full list)

```typescript
jsonSuccess(res, 'OK', data);
jsonSuccess(res, 'OK', data, meta, 200);            // with meta + custom status
jsonCreated(res, 'Created', data);                    // 201
jsonPaginated(res, 'OK', data, { total, page, limit, totalPages, hasNext, hasPrev });
jsonNoContent(res);                                   // 204
jsonError(res, 'Not found', 404);
jsonError(res, 'Forbidden', 403, 'FORBIDDEN');
jsonError(res, 'Bad request', 400, 'BAD_REQUEST', { field: ['error msg'] });
jsonUnauthorized(res);                                // 401
jsonForbidden(res);                                   // 403
jsonNotFound(res);                                    // 404
jsonValidationError(res, 'Failed', errors);           // 422
jsonServerError(res);                                 // 500
```

## Type Guards

```typescript
import { isNaraError, isValidationError } from '@core';

try {
  // ...
} catch (error) {
  if (isNaraError(error)) {
    // error.statusCode, error.code, error.message
  }
  if (isValidationError(error)) {
    // error.errors — Record<string, string[]>
  }
}
```

## Handler Mutation Pattern (create/update with constraint handling)

```typescript
import { randomUUID } from 'crypto';
import { hashPassword } from '@services/Authenticate';
import Logger from '@services/Logger';
import { createUser } from '@queries';
import { CreateUserSchema, zodToErrors } from '@validators';
import { jsonCreated, jsonError, jsonServerError, jsonValidationError } from '@core';

export const create = (req: NaraRequest, res: NaraResponse) => {
  if (!req.user) return jsonError(res, 'Unauthorized', 401);

  const parsed = CreateUserSchema.safeParse(req.body);
  if (!parsed.success) return jsonValidationError(res, 'Validation failed', zodToErrors(parsed.error));

  const { name, email, password } = parsed.data;

  try {
    const user = createUser({
      id: randomUUID(),
      name, email,
      password: hashPassword(password || email),
    });
    return jsonCreated(res, 'User berhasil dibuat', { user });
  } catch (error: unknown) {
    // Handle SQLite unique constraint violations
    if (error instanceof Error && 'code' in error && error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return jsonError(res, 'Email sudah digunakan', 400, 'DUPLICATE_EMAIL');
    }
    Logger.error('Failed to create user', error as Error);
    return jsonServerError(res, 'Gagal membuat user');
  }
};
```

## Validation (Zod)

```typescript
// validators/schemas.ts
import { z } from 'zod';

export const CreateUserSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email().transform(v => v.toLowerCase()),
  password: z.string().min(8).optional(),
});
export type CreateUserInput = z.infer<typeof CreateUserSchema>;

// In handler (JSON endpoint)
import { CreateUserSchema, zodToErrors } from '@validators';
import { jsonValidationError } from '@core';

const parsed = CreateUserSchema.safeParse(req.body);
if (!parsed.success) return jsonValidationError(res, 'Validation failed', zodToErrors(parsed.error));
const data = parsed.data; // fully typed

// In handler (Inertia form — redirect with error cookie)
const parsed = LoginSchema.safeParse(req.body);
if (!parsed.success) {
  const msg = Object.values(zodToErrors(parsed.error)).flat().join(', ');
  return res.cookie('error', msg, { maxAge: 5000 }).redirect('/login');
}
```

## Do / Don't

- **Do** use `return jsonError()` in handlers for explicit control flow
- **Do** use `throw notFoundError()` in deep services that don't have `res`
- **Do** wrap mutations (create/update) in `try/catch` for SQLite constraint handling
- **Do** log errors with `Logger.error()` before returning `jsonServerError`
- **Do** use Zod schemas for all input validation
- **Don't** catch errors in queries — let them bubble to handlers
- **Don't** use `console.log` or `console.error` — use `Logger`
- **Don't** mix languages in error messages — use Indonesian for user-facing messages (e.g. "User berhasil dibuat", "Email sudah digunakan")
- **Don't** expose internal error details (stack traces, SQL) in API responses
