# HTTP (API Resources)

## Overview

API Resources transform model records into controlled JSON responses. Used to hide sensitive fields (passwords), add computed fields, and format responses consistently.

## Structure

| File/Dir | Purpose |
|------|---------|
| `Resource.ts` | Abstract base class |
| `ResourceCollection.ts` | Collection wrapper with pagination |
| `resources/UserResource.ts` | User model → safe JSON |
| `index.ts` | Barrel export |

## Golden Pattern

```typescript
import { Resource } from "@core";
import type { UserRecord } from "@models/User";

export class UserResource extends Resource<UserRecord> {
  toArray(): Record<string, unknown> {
    return {
      id: this.data.id,
      name: this.data.name,
      email: this.data.email,
      // Never include: password, session tokens
      avatar: this.data.avatar,
      is_verified: this.data.is_verified,
      created_at: this.data.created_at,
      // Conditional field
      ...this.when(this.isAdmin, {
        phone: this.data.phone,
        roles: this.data.roles,
      }),
    };
  }
}
```

## How to Use in Controllers

```typescript
// Single record
const record = await User.findById(id);
return jsonSuccess(res, "User found", new UserResource(record).toArray());

// Collection (paginated)
const result = await paginate(query, { page, limit });
return jsonPaginated(res, "OK", result.data.map(r => new UserResource(r).toArray()), result.meta);
```

## Conventions

- Filename: `{Resource}Resource.ts` in `resources/` subdir
- Extend `Resource<ModelRecord>` from `@core`
- `toArray()` returns safe subset of fields — **never include passwords**
- Add to `index.ts` barrel
- Conditional fields via `this.when(condition, fields)`
