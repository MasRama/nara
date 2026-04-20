# Requests (Form Requests)

## Overview

Laravel-style FormRequests that combine authorization + validation. Use when a controller action requires both permission checks and input validation in one class.

## Structure

| File | Purpose |
|------|---------|
| `CreateUserRequest.ts` | Validate + authorize user creation |
| `UpdateUserRequest.ts` | Validate + authorize user update |
| `DeleteUsersRequest.ts` | Validate + authorize bulk user delete |
| `index.ts` | Barrel export |

## Golden Pattern

```typescript
import { FormRequest } from "@core";
import type { NaraRequest } from "@core";
import { CreateUserSchema, type CreateUserInput } from "@validators";
import { User } from "@models";

export class CreateUserRequest extends FormRequest<CreateUserInput> {
  static async from(req: NaraRequest): Promise<CreateUserRequest> {
    return super.fromRequest(req, CreateUserRequest);
  }

  async authorize(): Promise<boolean> {
    // Return true = allowed, false = ForbiddenError thrown
    const user = this.req.user;
    if (!user) return false;
    return User.isAdmin(user.id);
  }

  rules() {
    return CreateUserSchema;
  }
}

export default CreateUserRequest;
```

## How to Use in Controllers

```typescript
public async store(req: NaraRequest, res: NaraResponse) {
  const formReq = await this.getValidated(req, CreateUserRequest);
  const data = formReq.validated(); // typed as CreateUserInput
  // ...
}
```

## When to Use FormRequest vs Simple Schema

| Use FormRequest when | Use getBody(schema) when |
|---|---|
| Permission check needed (only admin, only owner) | Any authenticated user can do this |
| Complex multi-step authorization | Simple input validation only |
| Reuse across multiple controllers | One-off validation |

## Conventions

- Filename: `{Action}{Resource}Request.ts`
- Extend `FormRequest<InputType>` from `@core`
- `authorize()` returns `Promise<boolean>` — false throws ForbiddenError
- `rules()` returns validator function from `@validators`
- Export class + default export
- Add to `index.ts` barrel
