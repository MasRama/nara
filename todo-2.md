# Nara Project Scan Report - AI Ready & Full DX

> **Tujuan:** Membuat project AI-ready (standar konsisten, AI tidak halu) dan DX-friendly (less code, tooling enak)
> **Tanggal Scan:** 1 Desember 2025

---

## 📊 Executive Summary

### ✅ Yang Sudah Bagus

| Area | Status | Keterangan |
|------|--------|------------|
| **Core Types** | ✅ Excellent | `NaraRequest`, `NaraResponse`, `NaraMiddleware`, `NaraHandler` well-typed |
| **Error Classes** | ✅ Excellent | `HttpError`, `ValidationError`, dll dengan JSDoc lengkap |
| **Response Helpers** | ✅ Excellent | `jsonSuccess`, `jsonError`, `jsonPaginated` standardized |
| **Validation System** | ✅ Good | No external deps, pure TypeScript |
| **Path Aliases** | ✅ Excellent | `@core`, `@services/*`, `@controllers/*`, dll |
| **Constants** | ✅ Excellent | Centralized di `@config` |
| **CLI Scaffolding** | ✅ Good | `make:resource`, `make:controller`, dll |
| **Router** | ✅ Good | Type-safe dengan `group()` support |
| **AI Behavior Doc** | ✅ Good | `docs/AI_BEHAVIOR.md` ada |

### ❌ Yang Kurang (Gap Analysis)

| Area | Priority | Impact |
|------|----------|--------|
| **Base Controller** | 🔴 High | Repetitive auth checks, error handling |
| **Model/Entity Layer** | 🔴 High | Raw DB queries everywhere |
| **Schema Builder** | 🔴 High | Manual validator writing verbose |
| **Test Framework** | 🔴 High | Tidak ada test sama sekali |
| **ESLint + Prettier** | 🟡 Medium | Inconsistent code style |
| **OpenAPI Generation** | 🟡 Medium | AI tidak tahu API contracts |
| **Soft Delete** | 🟡 Medium | Manual implementation |
| **Event System** | 🟢 Low | No pub/sub pattern |
| **Job Queue** | 🟢 Low | No background jobs |

---

## 🏗️ 1. Architecture Improvements (Less Code)

### 1.1 Base Controller Class
**Problem:** Setiap controller repeat auth check, error handling, response pattern.

**Current Pattern (Repetitive):**
```typescript
// Setiap method harus check auth manual
public async create(request: Request, response: Response) {
  if (!request.user) {
    return response.status(401).json({ success: false, message: "Unauthorized" });
  }
  if (!request.user.is_admin) {
    return response.status(403).json({ success: false, message: "Forbidden" });
  }
  // ... logic
}
```

**Proposed Solution:**
```typescript
// app/core/BaseController.ts
abstract class BaseController {
  protected requireAuth(req: NaraRequest): asserts req is NaraRequest & { user: User } {
    if (!req.user) throw new AuthError();
  }
  
  protected requireAdmin(req: NaraRequest): asserts req is NaraRequest & { user: User } {
    this.requireAuth(req);
    if (!req.user.is_admin) throw new ForbiddenError();
  }
  
  protected async getBody<T>(req: NaraRequest, schema: Validator<T>): Promise<T> {
    const raw = await req.json();
    const result = schema(raw);
    if (!result.success) throw new ValidationError('Validation failed', result.errors);
    return result.data;
  }
}

// Usage - much cleaner
class PostController extends BaseController {
  async create(req: NaraRequest, res: NaraResponse) {
    this.requireAuth(req);
    const data = await this.getBody(req, CreatePostSchema);
    // ... logic
  }
}
```

**Files to Create:**
- [ ] `app/core/BaseController.ts`
- [ ] Update `app/core/index.ts` to export

---

### 1.2 Model/Entity Layer
**Problem:** Raw DB queries scattered, no type safety for database records.

**Current Pattern:**
```typescript
const user = await DB.from("users").where("id", id).first();
// user is `any` - no type safety
```

**Proposed Solution - Simple Model Pattern:**
```typescript
// app/models/User.ts
import DB from "@services/DB";

export interface UserRecord {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  password: string;
  avatar: string | null;
  is_admin: boolean;
  is_verified: boolean;
  created_at: number;
  updated_at: number;
}

export const User = {
  table: "users",
  
  async find(id: string): Promise<UserRecord | undefined> {
    return DB.from(this.table).where("id", id).first();
  },
  
  async findByEmail(email: string): Promise<UserRecord | undefined> {
    return DB.from(this.table).where("email", email.toLowerCase()).first();
  },
  
  async create(data: Omit<UserRecord, 'id' | 'created_at' | 'updated_at'>): Promise<UserRecord> {
    const now = dayjs().valueOf();
    const record = { id: randomUUID(), ...data, created_at: now, updated_at: now };
    await DB.table(this.table).insert(record);
    return record;
  },
  
  async update(id: string, data: Partial<UserRecord>): Promise<void> {
    await DB.from(this.table).where("id", id).update({ ...data, updated_at: dayjs().valueOf() });
  },
  
  async delete(id: string): Promise<boolean> {
    const deleted = await DB.from(this.table).where("id", id).delete();
    return deleted > 0;
  },
  
  // Query builder for complex queries
  query() {
    return DB.from<UserRecord>(this.table);
  }
};
```

**Files to Create:**
- [ ] `app/models/User.ts`
- [ ] `app/models/Session.ts`
- [ ] `app/models/index.ts`
- [ ] Update CLI `make:resource` to generate model

---

### 1.3 Schema Builder (Fluent Validation)
**Problem:** Manual validator writing is verbose and error-prone.

**Current Pattern (539 lines in schemas.ts):**
```typescript
export function CreateUserSchema(data: unknown): ValidationResult<CreateUserInput> {
  const errors: Record<string, string[]> = {};
  if (!isObject(data)) {
    return { success: false, errors: { _root: ['Data harus berupa object'] } };
  }
  const { name, email, phone } = data as Record<string, unknown>;
  if (!isString(name) || name.trim().length < 2) {
    errors.name = ['Nama minimal 2 karakter'];
  }
  // ... 50+ more lines
}
```

**Proposed Solution - Schema Builder:**
```typescript
// app/validators/builder.ts
import { s } from "@validators/builder";

// Declarative, type-safe, auto-inferred
export const CreateUserSchema = s.object({
  name: s.string().min(2).max(100).trim(),
  email: s.string().email().lowercase(),
  phone: s.string().phone().optional(),
  password: s.string().min(8).max(100).optional(),
  is_admin: s.boolean().default(false),
  is_verified: s.boolean().default(false),
});

// Type is auto-inferred!
type CreateUserInput = s.infer<typeof CreateUserSchema>;
```

**Builder Implementation:**
```typescript
// app/validators/builder.ts
class StringSchema {
  private rules: Array<(v: string) => string | null> = [];
  private _optional = false;
  private _default?: string;
  
  min(n: number, msg?: string) {
    this.rules.push(v => v.length < n ? (msg || `Minimal ${n} karakter`) : null);
    return this;
  }
  
  max(n: number, msg?: string) {
    this.rules.push(v => v.length > n ? (msg || `Maksimal ${n} karakter`) : null);
    return this;
  }
  
  email(msg?: string) {
    this.rules.push(v => !isEmail(v) ? (msg || 'Format email tidak valid') : null);
    return this;
  }
  
  // ... more methods
}

export const s = {
  string: () => new StringSchema(),
  number: () => new NumberSchema(),
  boolean: () => new BooleanSchema(),
  object: <T>(shape: T) => new ObjectSchema(shape),
  array: <T>(item: T) => new ArraySchema(item),
};
```

**Files to Create:**
- [ ] `app/validators/builder.ts`
- [ ] `app/validators/builder/StringSchema.ts`
- [ ] `app/validators/builder/NumberSchema.ts`
- [ ] `app/validators/builder/ObjectSchema.ts`
- [ ] Update `app/validators/index.ts`

---

### 1.4 Request DTO Auto-Generation
**Problem:** Manual interface definition for request data.

**Proposed Solution:**
```typescript
// Auto-infer from schema
const CreatePostSchema = s.object({
  title: s.string().min(1).max(255),
  content: s.string().min(1),
  published: s.boolean().default(false),
});

// Type auto-generated
type CreatePostInput = s.infer<typeof CreatePostSchema>;
// { title: string; content: string; published: boolean }
```

---

### 1.5 Timestamps & Soft Delete Mixin
**Problem:** Manual `created_at`, `updated_at`, `deleted_at` handling.

**Proposed Solution:**
```typescript
// app/models/mixins.ts
export const withTimestamps = {
  beforeCreate(record: any) {
    const now = dayjs().valueOf();
    record.created_at = now;
    record.updated_at = now;
  },
  beforeUpdate(record: any) {
    record.updated_at = dayjs().valueOf();
  }
};

export const withSoftDelete = {
  async softDelete(id: string) {
    return this.update(id, { deleted_at: dayjs().valueOf() });
  },
  
  queryActive() {
    return this.query().whereNull('deleted_at');
  },
  
  queryTrashed() {
    return this.query().whereNotNull('deleted_at');
  },
  
  async restore(id: string) {
    return this.update(id, { deleted_at: null });
  }
};
```

---

## 🤖 2. AI Readiness Improvements (Less Hallucination)

### 2.1 Machine-Readable Route Documentation
**Problem:** AI tidak tahu routes yang tersedia.

**Proposed Solution - Auto-generate `docs/ROUTES.md`:**
```markdown
# API Routes

## Public Routes
| Method | Path | Controller | Description |
|--------|------|------------|-------------|
| GET | `/` | HomeController.index | Home page |
| GET | `/login` | AuthController.loginPage | Login page |
| POST | `/login` | AuthController.processLogin | Process login |

## Protected Routes (Auth Required)
| Method | Path | Controller | Middleware | Description |
|--------|------|------------|------------|-------------|
| GET | `/dashboard` | AuthController.homePage | Auth | User dashboard |
| POST | `/users` | AuthController.createUser | Auth | Create user (admin) |
```

**CLI Command:**
```bash
node nara make:routes-docs
```

**Files to Create:**
- [ ] `commands/native/MakeRoutesDocs.ts`
- [ ] `docs/ROUTES.md` (generated)

---

### 2.2 Database Schema Documentation
**Problem:** AI tidak tahu struktur database.

**Proposed Solution - Auto-generate `docs/DATABASE_SCHEMA.md`:**
```markdown
# Database Schema

## users
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | string (UUID) | No | - | Primary key |
| name | string | No | - | User's full name |
| email | string | No | - | Unique email address |
| phone | string | Yes | null | Phone number |
| password | string | No | - | Hashed password |
| is_admin | boolean | No | false | Admin flag |
| is_verified | boolean | No | false | Email verified |
| created_at | bigint | No | - | Unix timestamp (ms) |
| updated_at | bigint | No | - | Unix timestamp (ms) |

### Indexes
- `users_email_unique` on `email`

### Conventions
- ID: UUID v4 via `randomUUID()`
- Timestamps: Unix milliseconds via `dayjs().valueOf()`
```

**CLI Command:**
```bash
node nara make:schema-docs
```

**Files to Create:**
- [ ] `commands/native/MakeSchemaDocs.ts`
- [ ] `docs/DATABASE_SCHEMA.md` (generated)

---

### 2.3 Environment Variables Documentation
**Problem:** AI tidak tahu env vars yang dibutuhkan.

**Proposed Solution - `docs/ENVIRONMENT.md`:**
```markdown
# Environment Variables

## Server
| Variable | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `PORT` | number | No | 5555 | Server port |
| `VITE_PORT` | number | No | 5173 | Vite dev server port |
| `NODE_ENV` | string | No | development | Environment |

## Database
| Variable | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `DB_CONNECTION` | string | No | development | Knex config key |

## Authentication
| Variable | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `GOOGLE_CLIENT_ID` | string | Yes* | - | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | string | Yes* | - | Google OAuth secret |
| `GOOGLE_REDIRECT_URI` | string | Yes* | - | OAuth callback URL |

*Required if using Google OAuth
```

**Files to Create:**
- [ ] `docs/ENVIRONMENT.md`
- [ ] Sync with `app/config/env.ts`

---

### 2.4 CLI Reference Documentation
**Problem:** AI tidak tahu CLI commands yang tersedia.

**Proposed Solution - `docs/CLI_REFERENCE.md`:**
```markdown
# Nara CLI Reference

## Resource Generation
### `make:resource <name> [options]`
Generate complete resource (controller, validator, routes).

**Options:**
- `--api` - Generate API-only (no Inertia pages)
- `--with-pages` - Generate Svelte page skeletons

**Example:**
```bash
node nara make:resource Post --with-pages
```

**Generated Files:**
- `app/controllers/PostController.ts`
- `app/validators/post.ts`
- `resources/js/Pages/Post/Index.svelte` (if --with-pages)
- `resources/js/Pages/Post/Create.svelte` (if --with-pages)
- `resources/js/Pages/Post/Edit.svelte` (if --with-pages)
- `resources/js/Pages/Post/Show.svelte` (if --with-pages)

## Database Commands
### `db:migrate`
Run pending migrations.

### `db:rollback`
Rollback last migration batch.

### `db:fresh`
Drop all tables and re-run migrations.

### `db:seed`
Run database seeders.
```

**Files to Create:**
- [ ] `docs/CLI_REFERENCE.md`

---

### 2.5 Core API Documentation
**Problem:** AI tidak tahu API `@core`.

**Proposed Solution - `docs/CORE_API.md`:**
```markdown
# Nara Core API

## App Bootstrap
```typescript
import { createApp } from '@core';
const app = createApp({ routes });
app.start();
```

## Router
```typescript
import { createRouter } from '@core';
const Route = createRouter();

Route.get('/path', handler);
Route.get('/path', [middleware], handler);
Route.group('/api', [Auth], (route) => {
  route.get('/users', UserController.index);
});
```

## Types
```typescript
import type { NaraRequest, NaraResponse, NaraMiddleware, NaraHandler } from '@core';
```

## Errors
```typescript
import { HttpError, ValidationError, AuthError, NotFoundError, ForbiddenError } from '@core';

throw new NotFoundError('User not found');
throw new ValidationError('Validation failed', { email: ['Invalid email'] });
```

## Response Helpers
```typescript
import { jsonSuccess, jsonError, jsonPaginated, jsonCreated } from '@core';

return jsonSuccess(res, 'Success', { data });
return jsonPaginated(res, 'Users', users, { total: 100, page: 1, limit: 10 });
return jsonCreated(res, 'Created', { user });
return jsonError(res, 'Error', 400, 'ERROR_CODE');
```
```

**Files to Create:**
- [ ] `docs/CORE_API.md`

---

### 2.6 AI Index Document
**Problem:** AI tidak tahu harus baca dokumen mana dulu.

**Proposed Solution - `docs/AI_INDEX.md`:**
```markdown
# AI Index - Start Here

## Quick Navigation
1. **Conventions** → `docs/AI_BEHAVIOR.md`
2. **API Routes** → `docs/ROUTES.md`
3. **Database** → `docs/DATABASE_SCHEMA.md`
4. **Environment** → `docs/ENVIRONMENT.md`
5. **CLI** → `docs/CLI_REFERENCE.md`
6. **Core API** → `docs/CORE_API.md`

## Before You Code
1. Check existing patterns in `docs/AI_BEHAVIOR.md`
2. Use CLI: `node nara make:resource <Name>` for new features
3. Follow path aliases: `@core`, `@services/*`, `@controllers/*`
4. Use response helpers from `@core`
5. Use validators from `@validators`

## File Structure
```
app/
├── controllers/  # Request handlers
├── services/     # Business logic
├── validators/   # Input validation
├── middlewares/  # Request middleware
├── config/       # Constants & env
└── core/         # Framework core
```
```

**Files to Create:**
- [ ] `docs/AI_INDEX.md`
- [ ] Update `docs/README.md` as index

---

## 🛠️ 3. Developer Experience (DX) Improvements

### 3.1 Test Framework Setup
**Problem:** No tests, `npm test` just echoes message.

**Proposed Solution:**
```bash
npm install -D vitest @vitest/coverage-v8
```

**Config - `vitest.config.ts`:**
```typescript
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
    },
  },
  resolve: {
    alias: {
      '@core': path.resolve(__dirname, './app/core'),
      '@services': path.resolve(__dirname, './app/services'),
      '@controllers': path.resolve(__dirname, './app/controllers'),
      '@validators': path.resolve(__dirname, './app/validators'),
      '@config': path.resolve(__dirname, './app/config'),
      '@type': path.resolve(__dirname, './type'),
    },
  },
});
```

**Example Test:**
```typescript
// tests/validators/schemas.test.ts
import { describe, it, expect } from 'vitest';
import { LoginSchema } from '@validators';

describe('LoginSchema', () => {
  it('should validate valid login data', () => {
    const result = LoginSchema({ email: 'test@example.com', password: 'password123' });
    expect(result.success).toBe(true);
  });

  it('should reject invalid email', () => {
    const result = LoginSchema({ email: 'invalid', password: 'password123' });
    expect(result.success).toBe(false);
  });
});
```

**Files to Create:**
- [ ] `vitest.config.ts`
- [ ] `tests/validators/schemas.test.ts`
- [ ] `tests/core/errors.test.ts`
- [ ] `tests/core/response.test.ts`
- [ ] Update `package.json` scripts

---

### 3.2 ESLint Setup
**Problem:** Only `tsc --noEmit`, no linting rules.

**Proposed Solution:**
```bash
npm install -D eslint @typescript-eslint/parser @typescript-eslint/eslint-plugin eslint-plugin-import
```

**Config - `eslint.config.mjs`:**
```javascript
import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';

export default [
  {
    files: ['**/*.ts'],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        project: './tsconfig.json',
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
    },
    rules: {
      // Enforce path aliases
      'no-restricted-imports': ['error', {
        patterns: [{
          group: ['../app/*', '../../app/*'],
          message: 'Use path aliases (@services/*, @controllers/*, etc.)',
        }],
      }],
      '@typescript-eslint/no-unused-vars': 'warn',
      '@typescript-eslint/no-explicit-any': 'warn',
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
];
```

**Files to Create:**
- [ ] `eslint.config.mjs`
- [ ] Update `package.json` scripts

---

### 3.3 Prettier Setup
**Problem:** Inconsistent code formatting.

**Proposed Solution:**
```bash
npm install -D prettier
```

**Config - `.prettierrc`:**
```json
{
  "semi": true,
  "singleQuote": true,
  "tabWidth": 2,
  "trailingComma": "es5",
  "printWidth": 100
}
```

**Files to Create:**
- [ ] `.prettierrc`
- [ ] `.prettierignore`
- [ ] Update `package.json` scripts

---

### 3.4 Pre-commit Hooks
**Problem:** No automated checks before commit.

**Proposed Solution:**
```bash
npm install -D husky lint-staged
npx husky init
```

**Config - `.husky/pre-commit`:**
```bash
npx lint-staged
```

**Config - `package.json`:**
```json
{
  "lint-staged": {
    "*.ts": ["eslint --fix", "prettier --write"],
    "*.{json,md}": ["prettier --write"]
  }
}
```

**Files to Create:**
- [ ] `.husky/pre-commit`
- [ ] Update `package.json`

---

### 3.5 GitHub Actions CI
**Problem:** No CI/CD pipeline.

**Proposed Solution - `.github/workflows/ci.yml`:**
```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'npm'
      - run: npm ci
      - run: npm run lint
      - run: npm run typecheck
      - run: npm test
      - run: npm run build
```

**Files to Create:**
- [ ] `.github/workflows/ci.yml`

---

## 🚀 4. Advanced Features (Future)

### 4.1 Event System
**Use Case:** Decouple side effects (send email after user created).

```typescript
// app/events/EventBus.ts
class EventBus {
  private listeners: Map<string, Function[]> = new Map();
  
  on(event: string, handler: Function) {
    const handlers = this.listeners.get(event) || [];
    handlers.push(handler);
    this.listeners.set(event, handlers);
  }
  
  emit(event: string, data: any) {
    const handlers = this.listeners.get(event) || [];
    handlers.forEach(h => h(data));
  }
}

// Usage
Events.on('user.created', async (user) => {
  await Mailer.sendWelcome(user.email);
});

Events.emit('user.created', newUser);
```

---

### 4.2 Job Queue
**Use Case:** Background processing (send emails, process images).

```typescript
// app/jobs/Queue.ts
interface Job {
  name: string;
  data: any;
  attempts: number;
  maxAttempts: number;
}

class Queue {
  async dispatch(name: string, data: any) {
    // Store in Redis or SQLite
    await Redis.lpush('jobs', JSON.stringify({ name, data, attempts: 0 }));
  }
  
  async process() {
    const job = await Redis.rpop('jobs');
    if (job) {
      const { name, data } = JSON.parse(job);
      await this.handlers[name](data);
    }
  }
}
```

---

### 4.3 Caching Abstraction
**Use Case:** Unified cache interface (Redis, Memory, File).

```typescript
// app/services/Cache.ts
interface CacheDriver {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttl?: number): Promise<void>;
  delete(key: string): Promise<void>;
}

class Cache {
  constructor(private driver: CacheDriver) {}
  
  async remember<T>(key: string, ttl: number, callback: () => Promise<T>): Promise<T> {
    const cached = await this.driver.get<T>(key);
    if (cached) return cached;
    
    const value = await callback();
    await this.driver.set(key, value, ttl);
    return value;
  }
}
```

---

### 4.4 OpenAPI/Swagger Generation
**Use Case:** Auto-generate API documentation.

```typescript
// Decorator-based approach
@Controller('/api/users')
class UserController {
  @Get('/')
  @Response(200, { type: 'array', items: UserSchema })
  async index() { /* ... */ }
  
  @Post('/')
  @Body(CreateUserSchema)
  @Response(201, UserSchema)
  async create() { /* ... */ }
}
```

---

## 📋 5. Priority Matrix

### Phase 1: Foundation (Week 1-2)
| Task | Priority | Effort | Impact |
|------|----------|--------|--------|
| Base Controller | 🔴 High | Medium | High |
| Schema Builder | 🔴 High | High | High |
| Test Framework | 🔴 High | Low | High |
| ESLint + Prettier | 🟡 Medium | Low | Medium |

### Phase 2: Documentation (Week 2-3)
| Task | Priority | Effort | Impact |
|------|----------|--------|--------|
| AI Index | 🔴 High | Low | High |
| Routes Docs | 🔴 High | Medium | High |
| Database Schema Docs | 🔴 High | Medium | High |
| CLI Reference | 🟡 Medium | Low | Medium |
| Core API Docs | 🟡 Medium | Medium | Medium |

### Phase 3: Model Layer (Week 3-4)
| Task | Priority | Effort | Impact |
|------|----------|--------|--------|
| Model Pattern | 🟡 Medium | High | High |
| Soft Delete | 🟡 Medium | Low | Medium |
| Timestamps Mixin | 🟡 Medium | Low | Medium |

### Phase 4: Tooling (Week 4-5)
| Task | Priority | Effort | Impact |
|------|----------|--------|--------|
| GitHub Actions | 🟡 Medium | Low | Medium |
| Pre-commit Hooks | 🟡 Medium | Low | Medium |
| CLI Route Docs Generator | 🟢 Low | Medium | Medium |

### Phase 5: Advanced (Future)
| Task | Priority | Effort | Impact |
|------|----------|--------|--------|
| Event System | 🟢 Low | Medium | Medium |
| Job Queue | 🟢 Low | High | Medium |
| Caching Abstraction | 🟢 Low | Medium | Low |
| OpenAPI Generation | 🟢 Low | High | Medium |

---

## 🎯 Recommended Starting Point

1. **Mulai dari Schema Builder** - Ini akan mengurangi boilerplate validation paling banyak
2. **Setup Test Framework** - Supaya bisa TDD untuk fitur baru
3. **Buat AI Index** - Supaya AI langsung tahu harus baca apa
4. **Base Controller** - Setelah schema builder, ini akan mengurangi boilerplate controller

---

## 📝 Notes

- Semua improvement di atas **backward compatible** dengan code existing
- Tidak perlu rewrite, cukup **add new patterns** dan **migrate gradually**
- Focus pada **less code** dan **AI tidak halu** sebagai north star
- Existing `todo.md` sudah cover documentation gaps, ini fokus ke **architecture improvements**
