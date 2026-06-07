# Nara Framework - Project Knowledge Base

**Generated:** 2026-06-07
**Commit:** df46fa3
**Branch:** (current)

## Overview

TypeScript web framework for building full-stack applications. Powered by HyperExpress + Svelte 5 + Inertia.js. MVC + Events + Services architecture.

## Mental Model (Start Here)

**If you're an AI reading this project for the first time, start here.**

### What is Nara?

Nara is a **TypeScript full-stack framework** for building modern web applications. It combines:
- **Backend**: HyperExpress (fast HTTP server) + Knex.js (SQL query builder)
- **Frontend**: Svelte 5 + Inertia.js (SPA-like experience without building an API)

### Architecture Pattern

```
┌─────────────────────────────────────────────────────────────────────┐
│                         BROWSER (Svelte 5)                          │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────────────────┐  │
│  │   Pages/    │◄───│  Components/│    │  $lib/api.ts (axios)    │  │
│  │  *.svelte   │    │  *.svelte   │    │  - handles CRUD calls   │  │
│  └──────┬──────┘    └─────────────┘    │  - shows toast alerts   │  │
│         │                              └────────────┬────────────┘  │
│         │ router.visit() for navigation             │ axios.get/post│
└─────────┼───────────────────────────────────────────┼───────────────┘
          │                                           │
          ▼                                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      SERVER (HyperExpress)                          │
│                                                                     │
│  Request ──► Middlewares ──► Router ──► Controller ──► Response    │
│                  │                         │             │          │
│                  │                         ▼             │          │
│                  │                    ┌─────────┐        │          │
│                  │                    │ Service │        │          │
│                  │                    └────┬────┘        │          │
│                  │                         │             │          │
│                  │                         ▼             │          │
│                  │                    ┌─────────┐        │          │
│                  │                    │  Model  │        │          │
│                  │                    └────┬────┘        │          │
│                  │                         │             │          │
│                  │                         ▼             │          │
│                  │                    ┌─────────┐        │          │
│                  │                    │  SQLite │        │          │
│                  │                    └─────────┘        │          │
│                  │                                       │          │
│                  ▼                                       ▼          │
│           ┌────────────┐                         ┌─────────────┐   │
│           │   auth.ts  │                         │   Inertia   │   │
│           │  csrf.ts   │                         │    OR       │   │
│           │ rateLimit  │                         │    JSON     │   │
│           └────────────┘                         └─────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

### Two Response Types (CRITICAL)

Every route returns **either** an Inertia response **or** a JSON response — never mix them:

| Route Type | Called By | Returns | Controller Method |
|------------|-----------|---------|-------------------|
| **Page route** | Browser navigation (`<a>`, `router.visit()`) | `res.inertia("PageName")` | `page()`, `usersPage()` |
| **Data route** | `axios.get/post/put/delete` from Svelte | `jsonSuccess()`, `jsonPaginated()` | `index()`, `store()`, `update()`, `destroy()` |

### Data Flow Example

```
1. User clicks "Users" link
   └─► router.visit("/users") 
       └─► GET /users → UserController.page() → res.inertia("users")
           └─► Renders resources/js/Pages/users.svelte

2. Svelte page loads, needs user data
   └─► api(() => axios.get("/users/data"))
       └─► GET /users/data → UserController.index() → jsonPaginated()
           └─► Returns { success: true, data: [...users], meta: {...} }
               └─► api() shows toast if error, returns data to Svelte

3. User clicks "Create User", fills form, submits
   └─► api(() => axios.post("/users", payload))
       └─► POST /users → UserController.store() → jsonCreated()
           └─► api() shows success toast, Svelte reloads data
```

### Where to Start Reading

| If you want to understand... | Read this file |
|------------------------------|----------------|
| How the app boots up | [`app/core/App.ts`](./app/core/AGENTS.md) |
| How routes are defined | [`routes/AGENTS.md`](./routes/AGENTS.md) |
| How controllers work | [`app/controllers/AGENTS.md`](./app/controllers/AGENTS.md) |
| How database models work | [`app/models/AGENTS.md`](./app/models/AGENTS.md) |
| How frontend pages work | [`resources/js/Pages/AGENTS.md`](./resources/js/Pages/AGENTS.md) |
| How auth/permissions work | [`app/authorization/AGENTS.md`](./app/authorization/AGENTS.md) |
| How CLI commands work | [`commands/native/AGENTS.md`](./commands/native/AGENTS.md) |

### Module Dependency Graph

```
@config (env, constants)
    │
    ▼
@core (App, Router, BaseController, errors, response)
    │
    ├──► @services (DB, Logger, Auth, Storage, Paginator)
    │         │
    │         ▼
    │    @models (User, Role, Session, etc.)
    │
    ├──► @middlewares (auth, csrf, rateLimit)
    │
    ├──► @validators (schemas, validate helpers)
    │
    ├──► @events (EventDispatcher)
    │
    └──► @authorization (Gates, Policies)
```

**Import rules:**
- `@core` can import from `@config`, `@services`
- `@services` can import from `@config`, `@models`
- `@models` can import from `@services/DB` only
- `@controllers` can import from anywhere
- `@middlewares` can import from `@services`, `@config`

## Structure

```
./
├── app/                    # Application source
│   ├── core/              # Framework kernel (BaseController, BaseModel, Router, App)
│   ├── controllers/       # HTTP handlers
│   ├── models/            # Active Record models
│   ├── services/          # Business logic (DB, Logger, Auth, GoogleAuth)
│   ├── middlewares/       # HTTP middleware (auth, rateLimit, csrf)
│   ├── validators/        # Input validation helpers
│   ├── requests/          # Form Request classes
│   ├── http/              # API Resources
│   ├── events/            # Event dispatcher
│   ├── authorization/     # RBAC gates & policies
│   ├── config/            # Environment & constants
│   └── helpers/            # Utilities
├── commands/native/        # CLI generators (22 commands)
├── routes/                 # Web routes
├── database/
│   ├── factories/         # Model factories (faker)
│   └── seeds/             # Seeders (run with db:seed)
├── resources/js/          # Svelte 5 frontend
├── migrations/            # Knex migrations (run with db:migrate)
└── server.ts              # HTTP server entry
```

## Entry Points

| File | Purpose |
|------|---------|
| `server.ts` | Web server entry (start with `npm run dev`) |
| `nara` | CLI entry (run `node nara <command>`) |
| `commands/index.ts` | CLI command handler |
| `knexfile.ts` | Database config for migrations |

## CLI Commands

```bash
# Generate
node nara make:resource Post
node nara make:controller PostController
node nara make:model Post
node nara make:migration create_posts_table

# Database
node nara db:migrate
node nara db:rollback
node nara db:fresh --seed
node nara db:seed
node nara db:status

# Dev
node nara generate:types
node nara lint
node nara doctor
```

## Conventions

- **2-space indent** (.editorconfig)
- **Strict TypeScript** (strict: true)
- **Path aliases** - Always use `@core`, `@models`, `@services`, etc.
- **No external validators** - Use `@validators/validate.ts` (NOT Zod/Yup/Joi)
- **Password hashing** - Use `Authenticate.hash()` from `@services`, NOT bcrypt directly

## Response Type Rules (CRITICAL)

This app is full-stack Inertia.js. There are **two distinct response types** — mixing them causes the error:
`"All Inertia requests must receive a valid Inertia response, however a plain JSON response was received."`

### Inertia Response — for page navigation (browser visits, `<a>` links, `router.visit()`)
```typescript
// controller method that renders a page
this.requireInertia(response);
return response.inertia("PageName", { prop1, prop2 });
```
- Use for: any route a user navigates TO in the browser
- NEVER return `jsonSuccess/jsonError/jsonCreated` from these routes

### JSON Response — for CRUD via fetch/AJAX from Svelte components
```typescript
// controller method called by fetch() from the frontend
return jsonSuccess(response, "Data retrieved", data);
return jsonCreated(response, "Created", record);
return jsonError(response, "Not found", 404);
```
- Use for: `store`, `update`, `destroy`, `index` (data endpoints called by `fetch()` in Svelte)
- NEVER called directly by browser navigation — always called from `fetch()` inside a component

### How the pattern works in practice

A typical resource has **1 Inertia route** + **N JSON routes**:

```typescript
// routes/web.ts
Route.get('/posts', [], PostController.page);          // INERTIA: renders page shell (browser navigation)
Route.get('/posts/data', [Auth], PostController.index); // JSON: fetch() for table data
Route.post('/posts', [Auth], PostController.store);     // JSON: fetch() to create
Route.put('/posts/:id', [Auth], PostController.update); // JSON: fetch() to update
Route.delete('/posts/:id', [Auth], PostController.destroy); // JSON: fetch() to delete
```

```typescript
// PostController.ts
public async page(req, res) {
  this.requireInertia(res);
  return res.inertia("posts/Index"); // renders the page shell — no data needed here
}

public async index(req, res) {
  // called by fetch() inside the Svelte page — returns JSON, NOT Inertia
  const result = await paginate(query, { page, limit });
  return jsonPaginated(res, "OK", result.data, result.meta);
}

public async store(req, res) {
  // called by fetch() from a form in the Svelte page
  const data = await this.getBody(req, CreatePostSchema);
  const record = await Post.create({ id: randomUUID(), ...data });
  return jsonCreated(res, "Created", record);
}
```

```svelte
<!-- resources/js/Pages/posts/Index.svelte -->
<script lang="ts">
  import axios from 'axios';
  import { api } from '$lib/api';

  let posts = $state([]);

  async function loadPosts() {
    const result = await api(() => axios.get('/posts/data'), { showSuccessToast: false });
    if (result.success) posts = result.data;
  }

  async function createPost(payload: Record<string, unknown>) {
    const result = await api(() => axios.post('/posts', payload));
    if (result.success) await loadPosts();
  }
</script>
```

## Anti-Patterns (DO NOT)

1. Use Zod/Yup/Joi for validation → use `@validators`
2. Manual bcrypt hash → use `Authenticate.hash()`
3. Relative imports for core modules → use `@core`
4. Forget BaseController extends → auto-binding breaks
5. Forget BaseModel<T> extends → CRUD methods unavailable
6. **Return `jsonSuccess/jsonError/jsonPaginated` from a page route** → causes `"All Inertia requests must receive a valid Inertia response, however a plain JSON response was received."` — user only sees raw JSON in the browser
7. **Call `res.inertia()` from a route called by `fetch()`** → returns wrong format to frontend fetch()
8. **Pass CRUD list data via `res.inertia()`** → data goes stale; always fetch from a separate JSON `/data` endpoint
9. **Name a page method `index`** → `index` implies JSON data endpoint; use `page` for Inertia page methods to avoid confusion

## Key Patterns

| Pattern | Location |
|---------|----------|
| Controller | `app/controllers/*.ts` - extend `BaseController` |
| Model | `app/models/*.ts` - extend `BaseModel<T>`, define `tableName` |
| Middleware | `app/middlewares/*.ts` - function(req, res, next) |
| Form Request | `app/requests/*.ts` - authorize() + rules() |
| API Resource | `app/http/resources/*.ts` - toArray() method |
| Factory | `database/factories/*.ts` - definition() + state modifiers |

## RBAC System (Role-Based Access Control)

Dynamic permission-based access control manageable from admin dashboard.

### Permission List

| Permission | Controls |
|------------|----------|
| `users.view` | View users page & list |
| `users.create` | Create new users |
| `users.edit` | Edit existing users |
| `users.delete` | Delete users |
| `roles.view` | View roles page & list |
| `roles.create` | Create new roles |
| `roles.edit` | Edit roles & assign permissions |
| `roles.delete` | Delete roles |
| `permissions.assign` | Assign permissions to roles |

### Backend Pattern - requirePermission()

```typescript
// app/core/BaseController.ts
protected requirePermission(permission: string, req: Request, res: Response): boolean {
  const user = req.user;
  if (!user) return this.deny(res, 'Unauthorized', 401);
  
  // Admin bypass - super admin has all permissions
  if (user.roles?.some((r: any) => r.name === 'admin')) return true;
  
  const hasPermission = user.permissions?.includes(permission);
  if (!hasPermission) return this.deny(res, 'Forbidden', 403);
  return true;
}

// Usage in controllers
public async store(req: Request, res: Response) {
  if (!this.requirePermission('users.create', req, res)) return;
  // ... create user logic
}
```

### Backend - RoleController

```typescript
// app/controllers/RoleController.ts
public async index(req, res) {
  const roles = await Role.query().withGraphFetched('permissions');
  return jsonSuccess(res, 'OK', roles);
}

public async store(req, res) {
  const data = await this.getBody(req, CreateRoleSchema);
  const role = await Role.create({ id: randomUUID(), ...data });
  await role.syncPermissions(data.permissions);
  return jsonCreated(res, 'Created', role);
}
```

### Frontend - Can.svelte Component

```svelte
<script lang="ts">
  import { page } from '@inertiajs/svelte';
  
  let { permission, children } = $props();
  
  const user = $derived(page.props.user);
  const can = $derived(
    user?.roles?.some((r: any) => r.name === 'admin') ||
    user?.permissions?.includes(permission)
  );
</script>

{#if can}
  {@render children()}
{/if}

<!-- Usage -->
<Can permission="users.edit">
  <button>Edit User</button>
</Can>
```

### Frontend - /roles Page

```svelte
<!-- resources/js/Pages/roles.svelte -->
<script lang="ts">
  import { api } from '$lib/api';
  import axios from 'axios';
  import RoleModal from '../Components/RoleModal.svelte';
  
  let roles = $state([]);
  let showModal = $state(false);
  let editingRole = $state(null);
  
  async function loadRoles() {
    const result = await api(() => axios.get('/roles/data'));
    if (result.success) roles = result.data;
  }
  
  async function createRole(data) {
    const result = await api(() => axios.post('/roles', data));
    if (result.success) {
      await loadRoles();
      showModal = false;
    }
  }
</script>

<Header group="roles" />

<Can permission="roles.create">
  <Button on:click={() => showModal = true}>Create Role</Button>
</Can>

{#each roles as role}
  <Can permission="roles.edit">
    <Button on:click={() => editRole(role)}>Edit</Button>
  </Can>
{/each}
```

### Form Request with Permission Check

```typescript
// app/requests/CreateUserRequest.ts
export class CreateUserRequest extends FormRequest {
  authorize(): boolean {
    return this.req.user?.permissions?.includes('users.create') ?? false;
  }
  
  rules() {
    return {
      name: 'required|string|min:3',
      email: 'required|email|unique:users,email',
      // ...
    };
  }
}
```

### Auth Middleware - Shared Props

```typescript
// app/middlewares/auth.ts - roles & permissions shared with Inertia
res.locals.user = {
  ...user,
  roles: user.roles.map(r => ({ id: r.id, name: r.name })),
  permissions: user.permissions.map(p => p.name)
};

// Access in Svelte via $page.props.user.permissions
```

## Build/Test

```bash
npm run dev      # Dev server (Vite + nodemon)
npm run build    # Production build
npm run lint     # tsc --noEmit
npm start        # Run production server
```

## Where to Look

| Task | Location |
|------|----------|
| Add new API endpoint | `app/controllers/` + `routes/web.ts` |
| Add database table | `migrations/` + `app/models/` |
| Authentication logic | `app/services/Authenticate.ts` |
| Authorization checks | `app/authorization/` |
| Validation rules | `app/validators/validate.ts` |
| CLI command | `commands/native/` |
| Frontend page | `resources/js/Pages/` |
