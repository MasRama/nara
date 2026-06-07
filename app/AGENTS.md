# app/ - Application Source

## Overview

The `app/` directory contains all application source code. It follows a layered architecture inspired by Laravel, with clear separation of concerns.

**Related docs:**
- [`../AGENTS.md`](../AGENTS.md) - Root project knowledge base (Mental Model, Architecture)
- [`../routes/AGENTS.md`](../routes/AGENTS.md) - Route definitions that connect to controllers
- [`../resources/js/AGENTS.md`](../resources/js/AGENTS.md) - Frontend Svelte code

## Module Map

```
app/
├── core/              # Framework kernel (App, Router, BaseController, errors)
├── controllers/       # HTTP request handlers (extend BaseController)
├── models/            # Database models (extend BaseModel, Active Record)
├── services/          # Business logic (DB, Logger, Auth, Storage)
├── middlewares/       # HTTP middleware (auth, CSRF, rate limiting)
├── validators/        # Input validation (custom, no Zod/Yup/Joi)
├── requests/          # Form Request classes (Laravel-style validation)
├── http/              # API Resources (data transformation)
├── events/            # Event system (dispatcher + listeners)
├── authorization/     # RBAC (Gates, Policies, Permissions)
├── config/            # Environment variables & constants
└── helpers/           # Utility functions
```

## Module Responsibilities

### `core/` - Framework Kernel
**Purpose:** Foundation classes that power the entire application.

| File | What it does |
|------|--------------|
| `App.ts` | Bootstraps server, applies middlewares, handles shutdown |
| `Router.ts` | Type-safe route registration (wraps HyperExpress.Router) |
| `BaseController.ts` | Base class for controllers (auth guards, validation, pagination) |
| `FormRequest.ts` | Laravel-style form request validation |
| `errors.ts` | HttpError hierarchy (404, 401, 403, 422, etc) |
| `response.ts` | JSON response helpers (jsonSuccess, jsonError, etc) |
| `types.ts` | Core TypeScript types (NaraRequest, NaraResponse, User) |

**See:** [`core/AGENTS.md`](./core/AGENTS.md)

---

### `controllers/` - HTTP Handlers
**Purpose:** Handle incoming HTTP requests, return responses.

**Pattern:**
```typescript
import { BaseController } from '@core';

class UserController extends BaseController {
  // Page route (Inertia response)
  async page(req, res) {
    this.requireInertia(res);
    return res.inertia("users");
  }

  // Data route (JSON response)
  async index(req, res) {
    this.requireAuth(req);
    const data = await User.findAll();
    return jsonSuccess(res, "OK", data);
  }
}
```

**See:** [`controllers/AGENTS.md`](./controllers/AGENTS.md)

---

### `models/` - Database Models
**Purpose:** Active Record pattern for database operations.

**Pattern:**
```typescript
import { BaseModel, BaseRecord } from './BaseModel';

interface UserRecord extends BaseRecord {
  id: string;
  name: string;
  email: string;
}

class UserModel extends BaseModel<UserRecord> {
  protected tableName = 'users';

  async findByEmail(email: string) {
    return this.findBy({ email });
  }
}

export const User = new UserModel();
```

**See:** [`models/AGENTS.md`](./models/AGENTS.md)

---

### `services/` - Business Logic
**Purpose:** Reusable services for common operations.

| Service | Purpose |
|---------|---------|
| `DB.ts` | Knex query builder instance |
| `Logger.ts` | Pino structured logging |
| `Authenticate.ts` | Password hashing, session management |
| `Storage.ts` | File upload/download |
| `Paginator.ts` | Query pagination helper |
| `LoginThrottle.ts` | Brute force protection |

**See:** [`services/AGENTS.md`](./services/AGENTS.md)

---

### `middlewares/` - HTTP Middleware
**Purpose:** Process requests before they reach controllers.

| Middleware | Purpose |
|------------|---------|
| `auth.ts` | Session-based authentication |
| `csrf.ts` | CSRF protection (Double Submit Cookie) |
| `rateLimit.ts` | Rate limiting (sliding window) |
| `securityHeaders.ts` | Security headers (HSTS, CSP, etc) |
| `inputSanitize.ts` | XSS input sanitization |

**See:** [`middlewares/AGENTS.md`](./middlewares/AGENTS.md)

---

### `validators/` - Input Validation
**Purpose:** Validate user input (custom implementation, no external libs).

**Pattern:**
```typescript
export function CreateUserSchema(raw: unknown): ValidationResult<CreateUserInput> {
  const errors: Record<string, string[]> = {};
  const data = raw as Record<string, unknown>;

  if (!isString(data.name) || isEmpty(data.name)) {
    errors.name = ['Nama wajib diisi'];
  }

  if (Object.keys(errors).length > 0) {
    return { success: false, errors };
  }

  return { success: true, data };
}
```

**See:** [`validators/AGENTS.md`](./validators/AGENTS.md)

---

### `events/` - Event System
**Purpose:** Decoupled side effects (emails, logging, notifications).

**Pattern:**
```typescript
// Dispatch after mutation
await event(new UserRegistered({ user }));

// Listen in bootstrap
eventDispatcher.on(UserRegistered, async (e) => {
  await sendWelcomeEmail(e.payload.user);
});
```

**See:** [`events/AGENTS.md`](./events/AGENTS.md)

---

### `authorization/` - RBAC
**Purpose:** Role-based access control with Gates and Policies.

**Pattern:**
```typescript
// In controller
await this.requirePermission(req, 'users.edit');

// Gate check
Gate.define('delete-post', (user, post) => {
  return user.id === post.user_id || user.is_admin;
});
```

**See:** [`authorization/AGENTS.md`](./authorization/AGENTS.md)

---

### `config/` - Configuration
**Purpose:** Environment variables and application constants.

| File | Purpose |
|------|---------|
| `env.ts` | Environment variable parsing and validation |
| `constants.ts` | Application constants (pagination, rate limits, etc) |

**See:** [`config/AGENTS.md`](./config/AGENTS.md)

---

### `helpers/` - Utilities
**Purpose:** Small utility functions used across the app.

| File | Purpose |
|------|---------|
| `authorization.ts` | Authorization helper wrapper |

**See:** [`helpers/AGENTS.md`](./helpers/AGENTS.md)

---

### `requests/` - Form Requests
**Purpose:** Laravel-style form request classes combining authorization + validation.

**Pattern:**
```typescript
class CreateUserRequest extends FormRequest<CreateUserInput> {
  authorize(): boolean {
    return this.user?.is_admin ?? false;
  }

  rules(): Record<string, Validator> {
    return {
      name: 'required|string|min:3',
      email: 'required|email|unique:users',
    };
  }
}
```

**See:** [`requests/AGENTS.md`](./requests/AGENTS.md)

---

### `http/` - API Resources
**Purpose:** Transform model data for API responses.

**Pattern:**
```typescript
class UserResource extends Resource {
  toArray(): Record<string, unknown> {
    return {
      id: this.id,
      name: this.name,
      email: this.email,
      // Hide sensitive fields
    };
  }
}
```

**See:** [`http/AGENTS.md`](./http/AGENTS.md)

---

## Path Aliases

All modules use path aliases defined in `tsconfig.json`:

| Alias | Path |
|-------|------|
| `@core` | `app/core` |
| `@controllers` | `app/controllers` |
| `@models` | `app/models` |
| `@services` | `app/services` |
| `@middlewares` | `app/middlewares` |
| `@validators` | `app/validators` |
| `@events` | `app/events` |
| `@config` | `app/config` |
| `@helpers` | `app/helpers` |
| `@requests` | `app/requests` |
| `@http` | `app/http` |
| `@authorization` | `app/authorization` |

**Always use aliases** — never relative imports like `../../models/User`.

## Request Lifecycle

```
1. Request arrives at server
         │
         ▼
2. Global middlewares run (compression, security, cors, request-id)
         │
         ▼
3. Auth middleware (if route requires it)
   └─► Sets req.user if session valid
         │
         ▼
4. Rate limiting / CSRF / Input sanitization
         │
         ▼
5. Router matches path → Controller method
         │
         ▼
6. Controller method runs:
   ├─► requireAuth() / requirePermission() guards
   ├─► getBody() validates input
   ├─► Model.query() / Service.method() for business logic
   └─► return jsonSuccess() / res.inertia() for response
         │
         ▼
7. Response sent to client
```

## Adding a New Feature

When adding a new feature (e.g., "Posts"), follow this order:

1. **Create migration**: `node nara make:migration create_posts_table`
2. **Create model**: `node nara make:model Post`
3. **Create validator**: `node nara make:validator CreatePost`
4. **Create controller**: `node nara make:controller PostController`
5. **Add routes**: Edit `routes/web.ts`
6. **Create Svelte page**: Add `resources/js/Pages/posts.svelte`
7. **Run migration**: `node nara db:migrate`

See [`../commands/native/AGENTS.md`](../commands/native/AGENTS.md) for CLI details.
