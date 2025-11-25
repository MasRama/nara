# AI Behavior Guidelines

Dokumentasi ini berisi konvensi dan pattern yang **WAJIB** diikuti oleh AI saat bekerja di project Nara. Tujuannya adalah menjaga konsistensi kode di seluruh codebase.

---

## 📁 Project Structure

```
nara/
├── app/
│   ├── controllers/     # HTTP request handlers
│   ├── middlewares/     # Request middlewares (auth, inertia)
│   ├── services/        # Business logic & utilities
│   ├── validators/      # Zod validation schemas
│   └── config/          # Constants & environment config
├── docs/                # Documentation
├── migrations/          # Knex database migrations
├── public/              # Static assets
├── resources/
│   ├── js/              # Frontend (Svelte/Inertia)
│   └── views/           # HTML templates
├── routes/              # Route definitions
├── seeds/               # Database seeders
├── type/                # TypeScript type definitions
├── server.ts            # Application entry point
└── knexfile.ts          # Database configuration
```

---

## 🔗 Import Path Aliases

**WAJIB** gunakan path aliases, **JANGAN** gunakan relative imports.

### Available Aliases

| Alias | Path | Usage |
|-------|------|-------|
| `@/*` | `app/*` | General app imports |
| `@controllers/*` | `app/controllers/*` | Controllers |
| `@services/*` | `app/services/*` | Services |
| `@middlewares/*` | `app/middlewares/*` | Middlewares |
| `@validators/*` | `app/validators/*` | Individual validators |
| `@validators` | `app/validators/index.ts` | All validators (barrel) |
| `@config/*` | `app/config/*` | Individual config |
| `@config` | `app/config/index.ts` | All config (barrel) |
| `@routes/*` | `routes/*` | Routes |
| `@resources/*` | `resources/*` | Frontend resources |
| `@type/*` | `type/*` | Individual types |
| `@type` | `type/index.d.ts` | All types (barrel) |
| `@root/*` | `./*` | Root directory |

### ✅ Correct

```typescript
import AuthController from "@controllers/AuthController";
import DB from "@services/DB";
import Logger from "@services/Logger";
import { validateOrFail, LoginSchema } from "@validators";
import { AUTH, PAGINATION, ERROR_MESSAGES } from "@config";
import { Request, Response } from "@type";
```

### ❌ Wrong

```typescript
// JANGAN gunakan relative imports
import AuthController from "../controllers/AuthController";
import DB from "../../services/DB";
```

---

## ✅ Zod Validation

**WAJIB** gunakan Zod untuk validasi semua input dari user.

### File Structure

```
app/validators/
├── index.ts      # Re-exports semua schemas & utilities
├── schemas.ts    # Definisi semua Zod schemas
└── validate.ts   # Helper functions (validate, validateOrFail)
```

### Creating New Schema

Tambahkan schema baru di `app/validators/schemas.ts`:

```typescript
// 1. Define schema dengan pesan error dalam Bahasa Indonesia
export const MyNewSchema = z.object({
  name: z.string().min(2, 'Nama minimal 2 karakter'),
  email: z.string().email('Format email tidak valid').transform(val => val.toLowerCase()),
  phone: z.string().optional().nullable(),
  is_active: z.boolean().optional().default(false),
});

// 2. Export type inference
export type MyNewInput = z.infer<typeof MyNewSchema>;
```

Kemudian export di `app/validators/index.ts`:

```typescript
export { MyNewSchema } from './schemas';
export type { MyNewInput } from './schemas';
```

### Using Validation in Controllers

```typescript
import { validateOrFail, MyNewSchema } from "@validators";

public async myMethod(request: Request, response: Response) {
  const rawData = await request.json();
  const data = await validateOrFail(MyNewSchema, rawData, response);
  if (!data) return; // Validation failed, response already sent
  
  // data is now typed and validated
  console.log(data.name); // TypeScript knows this is string
}
```

### Validation Error Response Format

```json
{
  "success": false,
  "message": "Validation failed",
  "errors": {
    "email": ["Format email tidak valid"],
    "password": ["Password minimal 8 karakter"]
  }
}
```

### Common Schemas (Reusable)

```typescript
// Gunakan schema yang sudah ada untuk konsistensi
import { EmailSchema, PasswordSchema, NameSchema, PhoneSchema, UUIDSchema } from "@validators";

export const MySchema = z.object({
  email: EmailSchema,           // Auto-lowercase, email validation
  password: PasswordSchema,     // Min 8, max 100 chars
  name: NameSchema,             // Min 2, max 100 chars, trimmed
  phone: PhoneSchema,           // Optional, 10-20 digits
  id: UUIDSchema,               // UUID format validation
});
```

---

## 📝 CRUD Patterns

### Controller Structure

```typescript
import DB from "@services/DB";
import Logger from "@services/Logger";
import { validateOrFail, CreateSchema, UpdateSchema } from "@validators";
import { AUTH, ERROR_MESSAGES, SUCCESS_MESSAGES } from "@config";
import { Request, Response } from "@type";
import { randomUUID } from "crypto";
import dayjs from "dayjs";

class MyController {
  // CREATE
  public async create(request: Request, response: Response) {
    // 1. Check authorization
    if (!request.user || !request.user.is_admin) {
      return response.status(403).json({ success: false, message: "Unauthorized" });
    }

    // 2. Validate input
    const rawData = await request.json();
    const data = await validateOrFail(CreateSchema, rawData, response);
    if (!data) return;

    // 3. Prepare data
    const now = dayjs().valueOf();
    const record = {
      id: randomUUID(),
      ...data,
      created_at: now,
      updated_at: now,
    };

    // 4. Insert with error handling
    try {
      await DB.table("my_table").insert(record);
      return response.json({ success: true, message: SUCCESS_MESSAGES.USER_CREATED, data: record });
    } catch (error: any) {
      if (error.code === "SQLITE_CONSTRAINT_UNIQUE") {
        return response.status(400).json({ success: false, message: "Data sudah ada" });
      }
      Logger.error('Failed to create record', error);
      return response.status(500).json({ success: false, message: "Gagal membuat data" });
    }
  }

  // READ (List with pagination)
  public async list(request: Request, response: Response) {
    const page = parseInt(request.query.page as string) || 1;
    const search = request.query.search as string || "";
    const filter = request.query.filter as string || "all";

    let query = DB.from("my_table").select("*");

    // Apply search
    if (search) {
      query = query.where(function() {
        this.where('name', 'like', `%${search}%`)
            .orWhere('email', 'like', `%${search}%`);
      });
    }

    // Apply filters
    if (filter === 'active') {
      query = query.where('is_active', true);
    }

    // Get total count
    const countQuery = query.clone();
    const total = await countQuery.count('* as count').first();

    // Get paginated results
    const data = await query
      .orderBy('created_at', 'desc')
      .offset((page - 1) * PAGINATION.DEFAULT_PAGE_SIZE)
      .limit(PAGINATION.DEFAULT_PAGE_SIZE);

    return response.json({
      success: true,
      data,
      meta: {
        total: Number((total as any)?.count) || 0,
        page,
        limit: PAGINATION.DEFAULT_PAGE_SIZE,
      }
    });
  }

  // READ (Single)
  public async show(request: Request, response: Response) {
    const { id } = request.params;
    
    const record = await DB.from("my_table").where("id", id).first();
    
    if (!record) {
      return response.status(404).json({ success: false, message: ERROR_MESSAGES.NOT_FOUND });
    }

    return response.json({ success: true, data: record });
  }

  // UPDATE
  public async update(request: Request, response: Response) {
    if (!request.user || !request.user.is_admin) {
      return response.status(403).json({ success: false, message: "Unauthorized" });
    }

    const { id } = request.params;
    if (!id) {
      return response.status(400).json({ success: false, message: "ID wajib diisi" });
    }

    const rawData = await request.json();
    const data = await validateOrFail(UpdateSchema, rawData, response);
    if (!data) return;

    const payload: Record<string, any> = { ...data, updated_at: dayjs().valueOf() };

    try {
      await DB.from("my_table").where("id", id).update(payload);
      const record = await DB.from("my_table").where("id", id).first();
      return response.json({ success: true, message: SUCCESS_MESSAGES.USER_UPDATED, data: record });
    } catch (error: any) {
      Logger.error('Failed to update record', error);
      return response.status(500).json({ success: false, message: "Gagal mengupdate data" });
    }
  }

  // DELETE
  public async delete(request: Request, response: Response) {
    if (!request.user || !request.user.is_admin) {
      Logger.logSecurity('Unauthorized delete attempt', { userId: request.user?.id, ip: request.ip });
      return response.status(403).json({ success: false, message: "Unauthorized" });
    }

    const rawData = await request.json();
    const data = await validateOrFail(DeleteSchema, rawData, response);
    if (!data) return;

    const deleted = await DB.from("my_table").whereIn("id", data.ids).delete();

    Logger.warn('Records deleted by admin', {
      adminId: request.user.id,
      deletedIds: data.ids,
      count: deleted,
      ip: request.ip
    });

    return response.json({ success: true, message: SUCCESS_MESSAGES.USER_DELETED, deleted });
  }
}

export default new MyController();
```

---

## 📤 Response Format

### Success Response

```typescript
// Single item
return response.json({
  success: true,
  message: "Data berhasil dibuat",
  data: { id: "...", name: "..." }
});

// List with pagination
return response.json({
  success: true,
  data: [...],
  meta: {
    total: 100,
    page: 1,
    limit: 10,
  }
});
```

### Error Response

```typescript
// Validation error (400)
return response.status(400).json({
  success: false,
  message: "Validation failed",
  errors: { field: ["error message"] }
});

// Unauthorized (401)
return response.status(401).json({
  success: false,
  message: "Unauthorized"
});

// Forbidden (403)
return response.status(403).json({
  success: false,
  message: "Akses ditolak"
});

// Not found (404)
return response.status(404).json({
  success: false,
  message: "Data tidak ditemukan"
});

// Server error (500)
return response.status(500).json({
  success: false,
  message: "Terjadi kesalahan internal"
});
```

---

## 📊 Logging

**WAJIB** gunakan Logger service, **JANGAN** gunakan `console.log`.

### Import

```typescript
import Logger from "@services/Logger";
```

### Log Levels

```typescript
Logger.trace("Very detailed debug info", { data });  // Development only
Logger.debug("Debug information", { data });          // Development
Logger.info("General information", { data });         // Production
Logger.warn("Warning message", { data });             // Important
Logger.error("Error message", error);                 // Errors
Logger.fatal("Fatal error", error);                   // Critical
```

### Specialized Logging

```typescript
// HTTP requests
Logger.logRequest({ method: "POST", url: "/api/users", statusCode: 200, responseTime: 45 });

// Authentication events
Logger.logAuth('login_success', { userId: user.id, email: user.email, ip: request.ip });

// Security events
Logger.logSecurity('Unauthorized access attempt', { userId: request.user?.id, ip: request.ip });
```

### Error Logging Pattern

```typescript
try {
  // ... operation
} catch (error: any) {
  Logger.error('Operation failed', error);
  return response.status(500).json({ success: false, message: "Gagal melakukan operasi" });
}
```

---

## ⚙️ Constants & Configuration

**WAJIB** gunakan constants dari `@config`, **JANGAN** hardcode magic numbers/strings.

### Import

```typescript
import { 
  AUTH,           // Authentication constants
  PAGINATION,     // Pagination defaults
  SERVER,         // Server config
  UPLOAD,         // File upload config
  HTTP_STATUS,    // HTTP status codes
  ERROR_MESSAGES, // Error messages (Indonesian)
  SUCCESS_MESSAGES, // Success messages (Indonesian)
  getEnv,         // Get environment variables
} from "@config";
```

### Usage Examples

```typescript
// Pagination
.limit(PAGINATION.DEFAULT_PAGE_SIZE)  // 10
.offset((page - 1) * PAGINATION.DEFAULT_PAGE_SIZE)

// Authentication
expires_at: dayjs().add(AUTH.TOKEN_EXPIRY_HOURS, 'hours').toDate()  // 24 hours
.cookie("error", message, AUTH.ERROR_COOKIE_EXPIRY_MS)  // 5 minutes

// Messages
return response.json({ success: false, message: ERROR_MESSAGES.NOT_FOUND });
return response.json({ success: true, message: SUCCESS_MESSAGES.USER_CREATED });

// HTTP Status
return response.status(HTTP_STATUS.NOT_FOUND).json({ ... });
```

### Available Constants

| Category | Constants |
|----------|-----------|
| `SERVER` | `MAX_BODY_SIZE`, `DEFAULT_PORT`, `DEFAULT_VITE_PORT` |
| `AUTH` | `TOKEN_EXPIRY_HOURS`, `SESSION_EXPIRY_MS`, `ERROR_COOKIE_EXPIRY_MS`, `MIN_PASSWORD_LENGTH`, `BCRYPT_SALT_ROUNDS` |
| `PAGINATION` | `DEFAULT_PAGE_SIZE`, `MAX_PAGE_SIZE`, `DEFAULT_PAGE` |
| `USER` | `MIN_NAME_LENGTH`, `MAX_NAME_LENGTH`, `MIN_PHONE_LENGTH`, `MAX_PHONE_LENGTH` |
| `UPLOAD` | `MAX_FILE_SIZE`, `ALLOWED_IMAGE_EXTENSIONS`, `AVATAR_DIR`, `ASSETS_DIR` |
| `HTTP_STATUS` | `OK`, `CREATED`, `BAD_REQUEST`, `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, etc. |
| `ERROR_MESSAGES` | `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `INVALID_CREDENTIALS`, etc. |
| `SUCCESS_MESSAGES` | `USER_CREATED`, `USER_UPDATED`, `USER_DELETED`, `PASSWORD_CHANGED`, etc. |

---

## 🔐 Authentication Patterns

### Checking Authentication

```typescript
// Check if user is authenticated
if (!request.user) {
  return response.status(401).json({ success: false, message: "Unauthorized" });
}

// Check if user is admin
if (!request.user || !request.user.is_admin) {
  return response.status(403).json({ success: false, message: "Unauthorized" });
}
```

### User Interface

```typescript
interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  avatar?: string;
  is_admin: boolean;
  is_verified: boolean;
  created_at?: number;
  updated_at?: number;
}
```

### Route Protection

```typescript
import Auth from "@middlewares/auth";

// Protected route
Route.get("/dashboard", [Auth], AuthController.homePage);

// Public route (no middleware)
Route.get("/login", AuthController.loginPage);
```

---

## 🗄️ Database Patterns

### Import

```typescript
import DB from "@services/DB";
```

### Query Patterns

```typescript
// Select all
const users = await DB.from("users").select("*");

// Select with conditions
const user = await DB.from("users").where("email", email).first();

// Insert
await DB.table("users").insert({ id: randomUUID(), name, email, ... });

// Update
await DB.from("users").where("id", id).update({ name, updated_at: dayjs().valueOf() });

// Delete
await DB.from("users").where("id", id).delete();

// Bulk delete
await DB.from("users").whereIn("id", ids).delete();

// Count
const total = await DB.from("users").count('* as count').first();
const count = Number((total as any)?.count) || 0;

// Search with OR conditions
query = query.where(function() {
  this.where('name', 'like', `%${search}%`)
      .orWhere('email', 'like', `%${search}%`);
});
```

### Timestamps

**WAJIB** gunakan `dayjs().valueOf()` untuk timestamps (Unix milliseconds).

```typescript
import dayjs from "dayjs";

const record = {
  id: randomUUID(),
  created_at: dayjs().valueOf(),
  updated_at: dayjs().valueOf(),
};
```

---

## 📝 TypeScript Patterns

### Type Imports

```typescript
import { Request, Response, User } from "@type";
```

### Null Checks (Strict Mode)

```typescript
// Always check for null/undefined
if (!request.user) {
  return response.status(401).json({ message: "Unauthorized" });
}

// After check, TypeScript knows user exists
const userId = request.user.id;  // OK
```

### Error Handling with Types

```typescript
try {
  // operation
} catch (error: any) {
  if (error.code === "SQLITE_CONSTRAINT_UNIQUE") {
    return response.status(400).json({ message: "Data sudah ada" });
  }
  Logger.error('Operation failed', error);
  throw error;
}
```

---

## 🛣️ Route Patterns

### File: `routes/web.ts`

```typescript
import HyperExpress from 'hyper-express';
import Auth from "@middlewares/auth";
import MyController from "@controllers/MyController";

const Route = new HyperExpress.Router();

// Public routes
Route.get("/", MyController.index);

// Protected routes (with Auth middleware)
Route.get("/dashboard", [Auth], MyController.dashboard);
Route.post("/items", [Auth], MyController.create);
Route.put("/items/:id", [Auth], MyController.update);
Route.delete("/items", [Auth], MyController.delete);

export default Route;
```

---

## 🎨 Frontend Patterns (Svelte/Inertia)

### Rendering Pages

```typescript
// Render Inertia page with props
return response.inertia("dashboard", { 
  users, 
  total,
  page,
  search,
  filter
});
```

### Redirect

```typescript
// Simple redirect
return response.redirect("/dashboard");

// Redirect with error cookie
return response
  .cookie("error", ERROR_MESSAGES.INVALID_CREDENTIALS, AUTH.ERROR_COOKIE_EXPIRY_MS)
  .redirect("/login");
```

---

## 📋 Checklist untuk AI

Sebelum membuat/mengubah kode, pastikan:

- [ ] Import menggunakan path aliases (`@controllers/*`, `@services/*`, dll)
- [ ] Input validation menggunakan Zod schemas
- [ ] Response format konsisten (`{ success, message, data, meta }`)
- [ ] Logging menggunakan Logger service (bukan `console.log`)
- [ ] Constants dari `@config` (bukan hardcode)
- [ ] Error handling dengan try-catch dan proper logging
- [ ] Null checks untuk `request.user` di protected routes
- [ ] Timestamps menggunakan `dayjs().valueOf()`
- [ ] UUID menggunakan `randomUUID()` dari crypto
- [ ] Pesan error dalam Bahasa Indonesia

---

## 🔄 Quick Reference

```typescript
// Standard imports for a controller
import DB from "@services/DB";
import Logger from "@services/Logger";
import { validateOrFail, MySchema } from "@validators";
import { AUTH, PAGINATION, ERROR_MESSAGES, SUCCESS_MESSAGES } from "@config";
import { Request, Response } from "@type";
import { randomUUID } from "crypto";
import dayjs from "dayjs";
```

```typescript
// Standard validation pattern
const rawData = await request.json();
const data = await validateOrFail(MySchema, rawData, response);
if (!data) return;
```

```typescript
// Standard auth check
if (!request.user || !request.user.is_admin) {
  return response.status(403).json({ success: false, message: "Unauthorized" });
}
```

```typescript
// Standard error handling
try {
  // operation
} catch (error: any) {
  Logger.error('Operation failed', error);
  return response.status(500).json({ success: false, message: "Terjadi kesalahan" });
}
```
