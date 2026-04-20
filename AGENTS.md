# Nara Framework - Project Knowledge Base

**Generated:** 2026-04-04
**Commit:** 1969dcc
**Branch:** (current)

## Overview

TypeScript web framework inspired by Laravel. Full-stack with HyperExpress + Svelte 5 + Inertia.js. MVC + Events + Services architecture.

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
  let posts = $state([]);

  async function loadPosts() {
    const res = await fetch('/posts/data');
    const json = await res.json();
    posts = json.data;
  }

  async function createPost(form: FormData) {
    await fetch('/posts', { method: 'POST', body: JSON.stringify(Object.fromEntries(form)) });
    await loadPosts();
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
