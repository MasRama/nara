# Nara AI Development Guidelines

> **Single source of truth** untuk AI assistants yang bekerja di project Nara.
> Baca file ini sebelum membuat perubahan apapun.

---

## Quick Reference

### Path Aliases (WAJIB)
```typescript
import { BaseController, jsonSuccess, jsonPaginated } from "@core";
import type { NaraRequest, NaraResponse } from "@core";
import { DB, Logger } from "@services";
import { LoginSchema } from "@validators";
import { AUTH, ERROR_MESSAGES } from "@config";

// ❌ JANGAN relative imports
import DB from "../../services/DB";
```

### Response Helpers
```typescript
jsonSuccess(res, 'Message', data);        // 200
jsonCreated(res, 'Created', data);        // 201
jsonPaginated(res, 'List', data, meta);   // 200 with pagination
jsonError(res, 'Error', 400);             // Custom error
jsonNotFound(res, 'Not found');           // 404
jsonUnauthorized(res, 'Unauthorized');    // 401
jsonValidationError(res, 'Invalid', errors); // 422
```

### Timestamps
```typescript
import dayjs from "dayjs";
const now = dayjs().valueOf();
{ created_at: now, updated_at: now }
```

---

## Backend Patterns

### Controller (WAJIB extend BaseController)
```typescript
import { BaseController, jsonSuccess, jsonCreated } from "@core";
import type { NaraRequest, NaraResponse } from "@core";
import { DB, Logger } from "@services";
import { CreateSchema } from "@validators";
import { ERROR_MESSAGES, SUCCESS_MESSAGES } from "@config";
import { randomUUID } from "crypto";
import dayjs from "dayjs";

class MyController extends BaseController {
  public async create(request: NaraRequest, response: NaraResponse) {
    this.requireAuth(request);  // throws AuthError
    const data = await this.getBody(request, CreateSchema);
    
    try {
      const now = dayjs().valueOf();
      const record = { id: randomUUID(), ...data, created_at: now, updated_at: now };
      await DB.table("items").insert(record);
      Logger.info('Item created', { id: record.id });
      return jsonCreated(response, SUCCESS_MESSAGES.DATA_CREATED, record);
    } catch (error: any) {
      Logger.error('Create failed', error);
      return jsonServerError(response, ERROR_MESSAGES.SERVER_ERROR);
    }
  }

  public async list(request: NaraRequest, response: NaraResponse) {
    const { page, limit, search } = this.getPaginationParams(request);
    let query = DB.from("items").select("*");
    if (search) query = query.where('name', 'like', `%${search}%`);
    const result = await paginate(query.orderBy('created_at', 'desc'), { page, limit });
    return jsonPaginated(response, SUCCESS_MESSAGES.DATA_RETRIEVED, result.data, result.meta);
  }
}

export default new MyController();
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

### Database Queries
```typescript
import { DB } from "@services";

const user = await DB.from("users").where("id", id).first();
await DB.table("users").insert({ id: randomUUID(), ...data, created_at: dayjs().valueOf() });
await DB.from("users").where("id", id).update({ name, updated_at: dayjs().valueOf() });
await DB.from("users").whereIn("id", ids).delete();
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
node nara make:resource Post --with-pages  # Full resource
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

- Gunakan path aliases (@core, @services, @validators, @config)
- Controller extends BaseController
- Gunakan response helpers (jsonSuccess, jsonError, dll)
- Gunakan Logger, bukan console.log
- Timestamps pakai dayjs().valueOf()
- Run `npx tsc --noEmit` untuk type check
- Frontend API calls pakai api() wrapper

---

## File Structure Quick Reference

```
app/
├── config/       → Constants, env (import from @config)
├── controllers/  → Extend BaseController
├── core/         → App, Router, Errors, Response (import from @core)
├── middlewares/  → Auth, CSRF, RateLimit
├── services/     → DB, Logger, Mailer (import from @services)
└── validators/   → Schemas (import from @validators)

resources/js/
├── Components/   → Svelte components + helper.ts
├── Pages/        → Inertia pages
└── types/        → Generated types (run generate:types)
```
