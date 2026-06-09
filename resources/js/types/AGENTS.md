# Types

Frontend TypeScript type definitions. `generated.ts` mirrors backend types.

## Structure

| File | Purpose |
|------|---------|
| `generated.ts` | Backend types synced to frontend (manually updated) |
| `index.ts` | Barrel export + custom frontend types |

## generated.ts

Contains: `User`, `Role`, `Permission`, `Session`, `UserForm`, `RoleForm`, `RoleInfo`, pagination types, API response types, and helper functions.

### Helper Functions

```typescript
import { createEmptyUserForm, userToForm, createEmptyRoleForm, roleToForm } from '../types';
import { isApiSuccess, isApiError } from '../types';

// Form factories — create pre-filled form data
const form = createEmptyUserForm();          // UserForm with defaults (id: null, roles: ['user'])
const form = userToForm(existingUser);       // UserForm pre-filled from User data

const form = createEmptyRoleForm();          // RoleForm with defaults (id: null, permissions: [])
const form = roleToForm(existingRole);       // RoleForm pre-filled from Role data

// Type guards — narrow ApiResponse union type
if (isApiSuccess(response)) { /* response.data is typed */ }
if (isApiError(response))   { /* response.errors is typed */ }
```

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
