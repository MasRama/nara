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

## Base Class
`BaseModel<T>` provides:
- `findById(id)`, `findBy(conditions)`, `findAllBy(conditions)`
- `create(data)`, `update(id, data)`, `delete(id)`
- `exists(conditions)`, `count(conditions?)`
- `query()` returns Knex query builder for advanced queries
- Automatic `created_at`/`updated_at` timestamps (configurable)

## Model Pattern
```typescript
import { BaseModel, BaseRecord } from "./BaseModel";

interface MyRecord extends BaseRecord {
  id: string;
  name: string;
}

class MyModel extends BaseModel<MyRecord> {
  protected tableName = "my_table";
  
  // Custom finders
  async findByName(name: string): Promise<MyRecord | undefined> {
    return this.query().where("name", name).first();
  }
}

export const MyModel = new MyModel();
export default MyModel;
```

**Key points:**
- Declare `tableName` as protected property
- Export singleton instance (`new MyModel()`)
- Use `this.query()` for Knex builder access
- Extend `BaseRecord` for id typing