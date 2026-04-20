# Validators

## Overview

Type-safe input validation without external libraries. All validation is done with internal helpers only — never Zod, Yup, or Joi.

## Structure

| File | Purpose |
|------|---------|
| `validate.ts` | Primitive helpers: `isString`, `isEmail`, `isPhone`, `isEmpty`, etc. |
| `schemas.ts` | Validator functions for each form/action |
| `index.ts` | Barrel export |

## ValidationResult Type

```typescript
type ValidationResult<T> =
  | { success: true; data: T }
  | { success: false; errors: Record<string, string[]> };
```

Errors object: field name → array of messages. Use `_root` key for global errors.

## Golden Pattern

```typescript
// In schemas.ts
import { isString, isEmail, isEmpty, minLength } from "./validate";

export interface CreateProductInput {
  name: string;
  price: number;
  description?: string;
}

export function CreateProductSchema(raw: unknown): ValidationResult<CreateProductInput> {
  const errors: Record<string, string[]> = {};
  const data = raw as Record<string, unknown>;

  if (!isString(data.name) || isEmpty(data.name)) {
    errors.name = ["Nama produk wajib diisi"];
  }

  if (typeof data.price !== "number" || data.price <= 0) {
    errors.price = ["Harga harus lebih dari 0"];
  }

  if (Object.keys(errors).length > 0) {
    return { success: false, errors };
  }

  return {
    success: true,
    data: {
      name: data.name as string,
      price: data.price as number,
      description: data.description as string | undefined,
    },
  };
}
```

## How Controllers Use Validators

```typescript
// Simple schema: use getBody()
const data = await this.getBody(req, CreateProductSchema);
// data is typed as CreateProductInput

// FormRequest: use getValidated()
const formReq = await this.getValidated(req, CreateProductRequest);
const data = formReq.validated();
```

## Conventions

- Schema function name: `{Action}{Resource}Schema` (e.g., `CreateUserSchema`)
- Input type: `{Action}{Resource}Input` (e.g., `CreateUserInput`)
- Error messages: Indonesian language
- Export schema AND input type from `schemas.ts`
- Add to `index.ts` barrel export
- **NEVER** use Zod, Yup, Joi, or any external validation library
