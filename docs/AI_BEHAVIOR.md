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

## ✅ Zod Validation

**WAJIB** validasi semua input dengan Zod.

```typescript
// Schema di app/validators/schemas.ts
export const MySchema = z.object({
  name: z.string().min(2, 'Nama minimal 2 karakter'),
  email: z.string().email('Format email tidak valid').transform(val => val.toLowerCase()),
});

// Penggunaan di Controller
const rawData = await request.json();
const data = await validateOrFail(MySchema, rawData, response);
if (!data) return; // Response sudah dikirim jika gagal
```

**Common Schemas:** `EmailSchema`, `PasswordSchema`, `NameSchema`, `PhoneSchema`, `UUIDSchema`

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

```typescript
// Success
{ success: true, message: "...", data: {...}, meta: { total, page } }

// Error
{ success: false, message: "...", errors?: { field: ["error"] } }
```

**Status Codes:** 400 (validation), 401 (unauthorized), 403 (forbidden), 404 (not found), 500 (server error)

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
