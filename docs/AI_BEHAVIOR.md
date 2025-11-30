# AI Behavior Guidelines - Nara Project

Konvensi **WAJIB** untuk menjaga konsistensi kode.

---

## 🔗 Import Path Aliases

**WAJIB** gunakan path aliases, **JANGAN** relative imports.

| Alias | Path |
|-------|------|
| `@controllers/*` | `app/controllers/*` |
| `@services/*` | `app/services/*` |
| `@middlewares/*` | `app/middlewares/*` |
| `@validators` | `app/validators/index.ts` |
| `@config` | `app/config/index.ts` |
| `@type` | `type/index.d.ts` |

```typescript
// ✅ Correct
import DB from "@services/DB";
import Logger from "@services/Logger";
import { validateOrFail, LoginSchema } from "@validators";
import { AUTH, PAGINATION, ERROR_MESSAGES } from "@config";
import { Request, Response } from "@type";

// ❌ Wrong - JANGAN relative imports
import DB from "../../services/DB";
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

// Penggunaan di Controller
const rawData = await request.json();
const data = await validateOrFail(MySchema, rawData, response);
if (!data) return; // Response sudah dikirim jika gagal
```

**Helper Functions:** `isString`, `isEmail`, `isPhone`, `isUUID`, `isNumber`, `isBoolean`, `isArray`, `isObject`

---

## 📝 Controller Pattern

```typescript
import DB from "@services/DB";
import Logger from "@services/Logger";
import { validateOrFail, CreateSchema } from "@validators";
import { ERROR_MESSAGES, SUCCESS_MESSAGES, PAGINATION } from "@config";
import { Request, Response } from "@type";
import { randomUUID } from "crypto";
import dayjs from "dayjs";

class MyController {
  public async create(request: Request, response: Response) {
    // 1. Auth check
    if (!request.user || !request.user.is_admin) {
      return response.status(403).json({ success: false, message: "Unauthorized" });
    }

    // 2. Validate
    const rawData = await request.json();
    const data = await validateOrFail(CreateSchema, rawData, response);
    if (!data) return;

    // 3. Execute
    try {
      const now = dayjs().valueOf();
      await DB.table("items").insert({ id: randomUUID(), ...data, created_at: now, updated_at: now });
      return response.json({ success: true, message: SUCCESS_MESSAGES.USER_CREATED });
    } catch (error: any) {
      Logger.error('Create failed', error);
      return response.status(500).json({ success: false, message: "Gagal membuat data" });
    }
  }

  public async list(request: Request, response: Response) {
    const page = parseInt(request.query.page as string) || 1;
    const total = await DB.from("items").count('* as count').first();
    const data = await DB.from("items")
      .orderBy('created_at', 'desc')
      .offset((page - 1) * PAGINATION.DEFAULT_PAGE_SIZE)
      .limit(PAGINATION.DEFAULT_PAGE_SIZE);

    return response.json({ success: true, data, meta: { total: Number((total as any)?.count) || 0, page } });
  }
}
```

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
// Auth check
if (!request.user) return response.status(401).json({ success: false, message: "Unauthorized" });
if (!request.user.is_admin) return response.status(403).json({ success: false, message: "Forbidden" });

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
