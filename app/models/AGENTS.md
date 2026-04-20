# Models

## Overview
Active Record pattern implementation using Knex.js. Provides type-safe database operations with automatic timestamps and query builder access.

## Structure
| File | Purpose |
|------|---------|
| `BaseModel.ts` | Abstract CRUD base class |
| `User.ts` | User entity with RBAC methods |
| `Role.ts` | Role entity with permission management |
| `Permission.ts` | Permission entity |
| `Session.ts` | Session management (30-day TTL) |
| `Asset.ts` | File upload metadata |
| `PasswordResetToken.ts` | Password reset tokens |
| `index.ts` | Barrel exports |

## Base Class API

`BaseModel<T>` provides these methods — call them on model instances:

| Method | Signature | Notes |
|--------|-----------|-------|
| `findById` | `(id: string \| number) → T \| undefined` | |
| `findBy` | `(conditions: Partial<T>) → T \| undefined` | First match |
| `findAllBy` | `(conditions: Partial<T>) → T[]` | All matches |
| `all` | `() → T[]` | Full table scan — avoid in production |
| `create` | `(data: Partial<T> & { id }) → T` | ID must be provided (use `randomUUID()`) |
| `update` | `(id, data: Partial<T>) → T \| undefined` | Auto-sets `updated_at` |
| `delete` | `(id) → number` | Returns rows deleted |
| `deleteBy` | `(conditions: Partial<T>) → number` | Bulk delete by conditions |
| `exists` | `(conditions: Partial<T>) → boolean` | |
| `count` | `(conditions?: Partial<T>) → number` | Optional WHERE filter |
| `query()` | `() → Knex.QueryBuilder` | Raw builder for complex queries |

## Timestamp Options

Override `timestampOptions` in the model class to customise:

```typescript
protected timestampOptions = {
  useTimestamps: true,          // default: true — auto-sets created_at/updated_at
  timestampFormat: 'bigint',    // 'bigint' (unix ms, Date.now()) | 'datetime' (Date object)
};

// Disable timestamps entirely (e.g. for junction tables)
protected timestampOptions = { useTimestamps: false };
```

Most models use `bigint`. `Asset` uses `datetime`. Junction tables (`user_roles`, `role_permissions`) use `useTimestamps: false`.

## Model Pattern

```typescript
import { BaseModel, BaseRecord } from "./BaseModel";
import { randomUUID } from "crypto";

interface PostRecord extends BaseRecord {
  id: string;
  title: string;
  content: string;
  user_id: string;
  created_at: number;
  updated_at: number;
}

class PostModel extends BaseModel<PostRecord> {
  protected tableName = "posts";

  // Custom finder
  async findByUserId(userId: string): Promise<PostRecord[]> {
    return this.query().where("user_id", userId).orderBy("created_at", "desc");
  }

  // Search + pagination query (pass to paginate())
  buildSearchQuery(search?: string) {
    let query = this.query().orderBy("created_at", "desc");
    if (search) {
      query = query.where("title", "like", `%${search}%`);
    }
    return query;
  }
}

export const Post = new PostModel();
export default Post;
```

Usage in controller:
```typescript
import { Post } from "@models";
import { randomUUID } from "crypto";
import { paginate } from "@services/Paginator";

// CRUD
const post = await Post.create({ id: randomUUID(), title, content, user_id });
const post = await Post.findById(id);
await Post.update(id, { title: "New Title" });
await Post.delete(id);

// Bulk delete
await Post.deleteBy({ user_id: userId });

// Paginated list
const { page, limit } = this.getPaginationParams(req);
const result = await paginate(Post.buildSearchQuery(search), { page, limit });
return jsonPaginated(res, "OK", result.data, result.meta);
```

## Conventions

- Filename: `{Name}.ts` (PascalCase, no "Model" suffix in filename e.g. `Post.ts`, `User.ts`)
- Class name: `{Name}Model extends BaseModel<{Name}Record>` 
- Export: singleton instance (`export const Post = new PostModel()`) + default
- IDs: always `string` UUID — use `randomUUID()` from `crypto` at creation time
- Import via `@models` barrel — never relative paths from outside `models/`