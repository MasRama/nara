# Types

Frontend TypeScript type definitions. `generated.ts` mirrors backend types.

## Structure

| File | Purpose |
|------|---------|
| `generated.ts` | Backend types synced to frontend (manually updated) |
| `index.ts` | Barrel export + custom frontend types |

## generated.ts

Contains: `User`, `Role`, `Permission`, `Session`, `UserForm`, pagination types, and helper functions that mirror `app/core/types.ts` and `app/types/models.ts`.

Manually maintained — when backend types change, update `generated.ts` accordingly.

## Adding Custom Types

Add custom frontend-only types to a new file, then re-export from `index.ts`:

```typescript
// resources/js/types/forms.ts
export interface CreateProductForm {
  name: string;
  price: number;
}

// resources/js/types/index.ts
export * from "./generated";
export * from "./forms"; // add here
```

## Import Pattern

```typescript
// In pages and components:
import type { User, PaginationMeta, UserForm } from "../types";
```

## Conventions

- Custom types → new `.ts` file → export from `index.ts`
- Keep `generated.ts` in sync with backend `app/types/models.ts`
