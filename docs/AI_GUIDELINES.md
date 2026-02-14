# Nara AI Development Guidelines

> **Single source of truth** untuk AI assistants yang bekerja di project Nara.
> Baca file ini sebelum membuat perubahan apapun.

---

## Quick Reference

### Path Aliases (WAJIB)
```typescript
import { BaseController, jsonSuccess, jsonPaginated } from "@core";
import type { NaraRequest, NaraResponse } from "@core";
import { User, Session, Asset } from "@models";  // ✅ Prefer models
import { Logger } from "@services";
import { LoginSchema } from "@validators";
import { AUTH, ERROR_MESSAGES } from "@config";

// ❌ JANGAN relative imports
import DB from "../../services/DB";
// ❌ JANGAN direct DB queries di controllers (gunakan models)
import DB from "@services/DB";
```

### Response Helpers
```typescript
jsonSuccess(res, 'Message', data);        // 200
jsonCreated(res, 'Created', data);        // 201
jsonPaginated(res, 'List', data, meta);   // 200 with pagination
jsonError(res, 'Error', 400);             // Custom error
jsonNotFound(res, 'Not found');           // 404
jsonUnauthorized(res, 'Unauthorized');    // 401
jsonForbidden(res, 'Forbidden');          // 403
jsonValidationError(res, 'Invalid', errors); // 422
jsonServerError(res, 'Error');            // 500
jsonNoContent(res);                       // 204
```

### Timestamps
```typescript
import dayjs from "dayjs";
const now = dayjs().valueOf();
{ created_at: now, updated_at: now }
```

---

## Backend Patterns

### Controller (WAJIB extend BaseController + gunakan Models)
```typescript
import { BaseController, jsonSuccess, jsonCreated, jsonNotFound, jsonServerError } from "@core";
import type { NaraRequest, NaraResponse } from "@core";
import { Item } from "@models";  // ✅ Import model
import { Logger } from "@services";
import { paginate } from "@services/Paginator";
import { CreateItemSchema } from "@validators";
import { ERROR_MESSAGES, SUCCESS_MESSAGES } from "@config";
import { randomUUID } from "crypto";

class ItemController extends BaseController {
  public async create(request: NaraRequest, response: NaraResponse) {
    this.requireAuth(request);  // throws AuthError
    const data = await this.getBody(request, CreateItemSchema);
    
    try {
      // ✅ Gunakan model (timestamps otomatis di BaseModel)
      const record = await Item.create({ id: randomUUID(), ...data });
      Logger.info('Item created', { id: record.id });
      return jsonCreated(response, SUCCESS_MESSAGES.DATA_CREATED, record);
    } catch (error: any) {
      Logger.error('Create failed', error);
      return jsonServerError(response, ERROR_MESSAGES.SERVER_ERROR);
    }
  }

  public async show(request: NaraRequest, response: NaraResponse) {
    const { id } = request.params;
    const item = await Item.findById(id);  // ✅ Model method
    if (!item) return jsonNotFound(response, ERROR_MESSAGES.NOT_FOUND);
    return jsonSuccess(response, SUCCESS_MESSAGES.DATA_RETRIEVED, item);
  }

  public async list(request: NaraRequest, response: NaraResponse) {
    const { page, limit, search } = this.getPaginationParams(request);
    // ✅ Model method yang return query builder untuk pagination
    const query = Item.buildSearchQuery(search);
    const result = await paginate(query, { page, limit });
    return jsonPaginated(response, SUCCESS_MESSAGES.DATA_RETRIEVED, result.data, result.meta);
  }
}

export default new ItemController();
```

### BaseController Methods
| Method | Description |
|--------|-------------|
| `this.requireAuth(request)` | Throws AuthError jika tidak login |
| `this.requireAdmin(request)` | Throws ForbiddenError jika bukan admin |
| `this.getBody(request, Schema)` | Validasi dan return data |
| `this.getPaginationParams(request)` | Return { page, limit, search } |

### Validation Schema
```typescript
export function MySchema(data: unknown): ValidationResult<MyInput> {
  const errors: Record<string, string[]> = {};
  if (!isObject(data)) return { success: false, errors: { _root: ['Data harus object'] } };
  
  const { name, email } = data as Record<string, unknown>;
  if (!isString(name) || name.trim().length < 2) errors.name = ['Nama minimal 2 karakter'];
  if (!isEmail(email)) errors.email = ['Format email tidak valid'];
  
  if (Object.keys(errors).length > 0) return { success: false, errors };
  return { success: true, data: { name: String(name).trim(), email: String(email).toLowerCase() } };
}
```

### Models (WAJIB untuk database operations)
```typescript
import { User, Session, Asset } from "@models";

// ✅ GUNAKAN models di controllers
const user = await User.findById(id);
const user = await User.findByEmail(email);
const user = await User.create({ id: randomUUID(), email, password });
const user = await User.update(id, { name });
await User.delete(id);
await User.deleteMany(ids);

// ✅ Query builder untuk pagination
const query = User.buildSearchQuery(search, filter);
const result = await paginate(query, { page, limit });
```

### Direct DB Queries (hanya di Models)
```typescript
// ❌ JANGAN di controllers - gunakan models
import DB from "@services/DB";
const user = await DB.from("users").where("id", id).first();

// ✅ Direct DB hanya di dalam model class
class UserModel extends BaseModel<UserRecord> {
  async customQuery() {
    return DB.from(this.tableName).where(...).first();
  }
}
```

### Logging (WAJIB, bukan console.log)
```typescript
import { Logger } from "@services";

Logger.info("Message", { data });
Logger.error("Error", error);
Logger.warn("Warning", { data });
Logger.logAuth('login_success', { userId, ip });
Logger.logSecurity('Unauthorized attempt', { ip });
```

### Routes
```typescript
import Auth from "@middlewares/auth";
Route.get("/public", Controller.index);           // Public
Route.get("/dashboard", [Auth], Controller.show); // Protected
```

---

## Frontend Patterns (Svelte/Inertia)

### Imports
```typescript
import { page as inertiaPage, router } from '@inertiajs/svelte';
import Header from '../Components/Header.svelte';
import type { User, PaginationMeta } from '../types';
import { api, Toast } from '../Components/helper';
```

### API Calls (WAJIB pakai api() wrapper)
```typescript
const result = await api(() => axios.post('/users', payload));
if (result.success) { /* handle */ }

// ❌ JANGAN direct axios
const response = await axios.post('/users', payload);
```

### Toast
```typescript
Toast('Berhasil', 'success');
Toast('Gagal', 'error');
```

### Navigation
```typescript
router.visit('/dashboard', { preserveScroll: true });
```

### Auth Check
```svelte
<script lang="ts">
  import { page as inertiaPage } from '@inertiajs/svelte';
  const currentUser = $inertiaPage.props.user as User | undefined;
</script>

{#if currentUser?.is_admin}
  <button>Admin Only</button>
{/if}
```

---

## CLI Commands

```bash
# Scaffolding
node nara make:resource Post --with-model  # Full resource + model
node nara make:resource Post --with-pages  # Full resource + Svelte pages
node nara make:model Post                  # Model only
node nara make:controller User             # Controller only
node nara make:validator Post              # Validator only

# Database
node nara db:migrate                       # Run migrations
node nara db:fresh --seed                  # Fresh + seed

# Development
node nara generate:types                   # Sync backend→frontend types
node nara doctor                           # Check project health
node nara lint                             # TypeScript check
```

---

## Quick Reference

- Gunakan path aliases (@core, @services, @validators, @config, @models)
- Controller extends BaseController
- **Gunakan Models untuk database operations, bukan direct DB queries**
- Gunakan response helpers (jsonSuccess, jsonError, dll)
- Gunakan Logger, bukan console.log
- Timestamps otomatis di BaseModel (tidak perlu manual)
- Run `npx tsc --noEmit` untuk type check
- Frontend API calls pakai api() wrapper

---

## File Structure Quick Reference

```
app/
├── config/       → Constants, env (import from @config)
├── controllers/  → Extend BaseController, gunakan Models
├── core/         → App, Router, Errors, Response (import from @core)
├── middlewares/  → Auth, CSRF, RateLimit
├── models/       → Database models (import from @models) ⭐ NEW
├── services/     → DB, Logger, Mailer (import from @services)
└── validators/   → Schemas (import from @validators)

resources/js/
├── Components/   → Svelte components + helper.ts
├── Pages/        → Inertia pages
└── types/        → Generated types (run generate:types)
```

---

## Model Pattern

### Creating a Model
```bash
node nara make:model Post
```

### Model Structure
```typescript
// app/models/Post.ts
import { BaseModel, BaseRecord } from "./BaseModel";

export interface PostRecord extends BaseRecord {
  id: string;
  title: string;
  content: string | null;
  user_id: string;
  created_at: number;
  updated_at: number;
}

export interface CreatePostData {
  id: string;
  title: string;
  content?: string | null;
  user_id: string;
}

class PostModel extends BaseModel<PostRecord> {
  protected tableName = "posts";

  async findByUserId(userId: string): Promise<PostRecord[]> {
    return this.query().where("user_id", userId);
  }

  buildSearchQuery(search?: string) {
    let query = this.query().select("*");
    if (search) {
      query = query.where('title', 'like', `%${search}%`);
    }
    return query.orderBy('created_at', 'desc');
  }
}

export const Post = new PostModel();
export default Post;
```

### Export in index.ts
```typescript
// app/models/index.ts
export { Post, PostRecord, CreatePostData } from './Post';
```

### BaseModel Methods
| Method | Description |
|--------|-------------|
| `findById(id)` | Find by primary key |
| `findBy(field, value)` | Find by any field |
| `create(data)` | Insert with auto timestamps |
| `update(id, data)` | Update with auto updated_at |
| `delete(id)` | Delete by ID |
| `query()` | Get Knex query builder |
