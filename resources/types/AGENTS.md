---
authority: canon
owner: masrama
last_verified: 2026-06-28
scope: resources/types
---

# Types

> **Authority:** canon — current source of truth for frontend type conventions.

Frontend TypeScript type definitions. Shared types are sourced from `app/types/shared.ts` (single source of truth).

## Structure

| File | Purpose |
|------|---------|
| `generated.ts` | Re-exports shared types from `app/types/shared.ts` + frontend-only types (forms, helpers) |
| `index.ts` | Barrel export + custom frontend types |

## Single Source of Truth

Shared types (`User`, `Role`, `Permission`, `Session`, `PaginationMeta`, `ApiResponse`, etc.) live in **`app/types/shared.ts`** and are re-exported from `generated.ts`. When backend types change, update `app/types/shared.ts` — the frontend automatically gets the changes.

Database model types with sensitive fields (`password`, `remember_me_token`) stay in `app/types/models.ts` and are **never** exposed to the frontend.

### Helper Functions (frontend-only)

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

## Adding Custom Types

Add custom frontend-only types to a new file, then re-export from `index.ts`:

```typescript
// resources/types/forms.ts
export interface CreateProductForm {
  name: string;
  price: number;
}

// resources/types/index.ts
export * from "./generated";
export * from "./forms"; // add here
```

## Import Pattern

```typescript
// In pages and components:
import type { User, PaginationMeta, UserForm } from "../types";
```

## Conventions

- Shared types → `app/types/shared.ts` (single source for backend + frontend)
- Frontend-only types (forms, helpers) → `generated.ts` or new `.ts` file
- Custom types → new `.ts` file → export from `index.ts`
- Database models with sensitive fields → `app/types/models.ts` (backend only, never exposed)
