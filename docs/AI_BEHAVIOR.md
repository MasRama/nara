# AI Behavior Guidelines - Nara Project

Konvensi **WAJIB** untuk menjaga konsistensi kode.

---

## 🔗 Import Path Aliases

**WAJIB** gunakan path aliases, **JANGAN** relative imports.

| Alias | Path |
|-------|------|
| `@core` | `app/core/index.ts` |
| `@controllers/*` | `app/controllers/*` |
| `@services` | `app/services/index.ts` |
| `@services/*` | `app/services/*` |
| `@middlewares/*` | `app/middlewares/*` |
| `@validators` | `app/validators/index.ts` |
| `@config` | `app/config/index.ts` |

```typescript
// ✅ Correct
import { BaseController, jsonSuccess, jsonPaginated, jsonCreated } from "@core";
import type { NaraRequest, NaraResponse } from "@core";
import { DB, Logger } from "@services";
import { LoginSchema } from "@validators";
import { AUTH, PAGINATION, ERROR_MESSAGES, SUCCESS_MESSAGES } from "@config";

// ❌ Wrong - JANGAN relative imports
import DB from "../../services/DB";

// ❌ Wrong - JANGAN gunakan @type (tidak ada)
import { Request, Response } from "@type";
```

---

## ✅ Simple Validation

**WAJIB** validasi semua input dengan validation functions.

```typescript
// Validator di app/validators/schemas.ts
export function MySchema(data: unknown): ValidationResult<MyInput> {
  const errors: Record<string, string[]> = {};
  
  if (!isObject(data)) {
    return { success: false, errors: { _root: ['Data harus berupa object'] } };
  }

  const { name, email } = data as Record<string, unknown>;

  if (!isString(name) || name.trim().length < 2) {
    errors.name = ['Nama minimal 2 karakter'];
  }

  if (!isEmail(email)) {
    errors.email = ['Format email tidak valid'];
  }

  if (Object.keys(errors).length > 0) {
    return { success: false, errors };
  }

  return {
    success: true,
    data: {
      name: String(name).trim(),
      email: String(email).toLowerCase(),
    }
  };
}
```

**Penggunaan di Controller (WAJIB gunakan BaseController.getBody):**
```typescript
// ✅ Correct - gunakan this.getBody() dari BaseController
const data = await this.getBody(request, MySchema);
// Throws ValidationError jika gagal, tidak perlu check null

// ❌ Wrong - pattern lama, jangan gunakan
const data = await validateOrFail(MySchema, rawData, response);
if (!data) return;
```

**Helper Functions:** `isString`, `isEmail`, `isPhone`, `isUUID`, `isNumber`, `isBoolean`, `isArray`, `isObject`

---

## 📝 Controller Pattern

**WAJIB** extend `BaseController` untuk semua controller baru.

```typescript
import { BaseController, jsonSuccess, jsonPaginated, jsonCreated, jsonNotFound, jsonServerError } from "@core";
import type { NaraRequest, NaraResponse } from "@core";
import DB from "@services/DB";
import Logger from "@services/Logger";
import { paginate } from "@services/Paginator";
import { CreateSchema } from "@validators";
import { ERROR_MESSAGES, SUCCESS_MESSAGES } from "@config";
import { randomUUID } from "crypto";
import dayjs from "dayjs";

class MyController extends BaseController {
  public async create(request: NaraRequest, response: NaraResponse) {
    // 1. Auth check - gunakan helper dari BaseController
    this.requireAuth(request);  // throws AuthError jika tidak login
    // this.requireAdmin(request);  // untuk admin-only

    // 2. Validate - gunakan this.getBody()
    const data = await this.getBody(request, CreateSchema);

    // 3. Execute
    try {
      const now = dayjs().valueOf();
      const record = { id: randomUUID(), ...data, created_at: now, updated_at: now };
      await DB.table("items").insert(record);
      Logger.info('Item created', { id: record.id, userId: request.user!.id });
      return jsonCreated(response, SUCCESS_MESSAGES.DATA_CREATED, record);
    } catch (error: any) {
      Logger.error('Create failed', error);
      return jsonServerError(response, ERROR_MESSAGES.SERVER_ERROR);
    }
  }

  public async list(request: NaraRequest, response: NaraResponse) {
    // Gunakan helper dari BaseController
    const { page, limit, search } = this.getPaginationParams(request);
    
    let query = DB.from("items").select("*");
    if (search) {
      query = query.where('name', 'like', `%${search}%`);
    }

    // Gunakan paginate helper
    const result = await paginate(query.orderBy('created_at', 'desc'), { page, limit });

    return jsonPaginated(response, SUCCESS_MESSAGES.DATA_RETRIEVED, result.data, result.meta);
  }
}

export default new MyController();
```

**BaseController Methods:**
- `this.requireAuth(request)` - throws AuthError jika tidak login
- `this.requireAdmin(request)` - throws ForbiddenError jika bukan admin
- `this.getBody(request, Schema)` - validasi dan return data, throws ValidationError
- `this.getPaginationParams(request)` - return { page, limit, search }

---

## 📤 Response Format

**WAJIB** gunakan response helpers dari `@core`.

```typescript
import { 
  jsonSuccess, jsonError, jsonPaginated, jsonCreated,
  jsonUnauthorized, jsonForbidden, jsonNotFound, jsonValidationError 
} from "@core";

// Success dengan data
return jsonSuccess(res, 'User found', { user });

// Success dengan pagination
return jsonPaginated(res, 'Users retrieved', users, { total: 100, page: 1, limit: 10 });

// Created (201)
return jsonCreated(res, 'User created', { user });

// Error responses
return jsonUnauthorized(res, 'Invalid credentials');
return jsonForbidden(res, 'Admin access required');
return jsonNotFound(res, 'User not found');
return jsonValidationError(res, 'Validation failed', { email: ['Invalid email'] });
return jsonError(res, 'Custom error', 400, 'CUSTOM_CODE');
```

**Response Structure:**
```typescript
// Success: { success: true, message, data?, meta? }
// Error: { success: false, message, code?, errors? }
```

**Status Codes:** 200 (ok), 201 (created), 400 (bad request), 401 (unauthorized), 403 (forbidden), 404 (not found), 422 (validation), 500 (server error)

---

## 📊 Logging

**WAJIB** `Logger`, **JANGAN** `console.log`.

```typescript
import Logger from "@services/Logger";

Logger.info("Info", { data });
Logger.warn("Warning", { data });
Logger.error("Error", error);
Logger.logAuth('login_success', { userId, ip });
Logger.logSecurity('Unauthorized attempt', { ip });
```

---

## ⚙️ Constants

**WAJIB** dari `@config`, **JANGAN** hardcode.

| Category | Usage |
|----------|-------|
| `AUTH` | `TOKEN_EXPIRY_HOURS`, `SESSION_EXPIRY_MS`, `BCRYPT_SALT_ROUNDS` |
| `PAGINATION` | `DEFAULT_PAGE_SIZE`, `MAX_PAGE_SIZE` |
| `ERROR_MESSAGES` | `NOT_FOUND`, `UNAUTHORIZED`, `INVALID_CREDENTIALS` |
| `SUCCESS_MESSAGES` | `USER_CREATED`, `USER_UPDATED`, `USER_DELETED` |
| `HTTP_STATUS` | `OK`, `BAD_REQUEST`, `NOT_FOUND` |

---

## 🔐 Auth & Database

```typescript
// ✅ Auth check - gunakan BaseController methods
this.requireAuth(request);   // throws AuthError
this.requireAdmin(request);  // throws ForbiddenError

// ❌ Wrong - pattern lama, jangan gunakan
if (!request.user) return response.status(401).json({ success: false, message: "Unauthorized" });

// DB queries
const user = await DB.from("users").where("email", email).first();
await DB.table("users").insert({ id: randomUUID(), ...data });
await DB.from("users").where("id", id).update({ ...data, updated_at: dayjs().valueOf() });
await DB.from("users").whereIn("id", ids).delete();

// Timestamps - WAJIB dayjs().valueOf()
{ created_at: dayjs().valueOf(), updated_at: dayjs().valueOf() }
```

---

## 🛣️ Routes

```typescript
import Auth from "@middlewares/auth";
Route.get("/public", Controller.index);           // Public
Route.get("/dashboard", [Auth], Controller.show); // Protected
```

---

## 🎨 Frontend (Inertia)

```typescript
return response.inertia("dashboard", { users, total, page });
return response.redirect("/dashboard");
```

---
