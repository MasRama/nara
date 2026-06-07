# Nara - AI Context File

> This file is optimized for AI assistants (Cursor, Copilot, Claude, etc).
> For human-readable documentation, see [README.md](./README.md).

## Tech Stack

| Layer | Technology | Language |
|-------|------------|----------|
| Runtime | Node.js >= 20 | **TypeScript** |
| HTTP Server | HyperExpress | TypeScript |
| Frontend | Svelte 5 + Inertia.js | TypeScript/Svelte |
| Database | SQLite (better-sqlite3) | SQL |
| Query Builder | Knex.js | TypeScript |
| Bundler | Vite | JavaScript |
| Testing | Vitest | TypeScript |

**IMPORTANT: This is a TypeScript project, NOT PHP.**

## Quick Context

```
Nara = TypeScript full-stack framework
     = HyperExpress (server) + Svelte 5 (frontend) + Inertia.js (glue)
     = SQLite database with Active Record models
     = MVC architecture with Events and Services
```

## Entry Points

| File | Purpose | When to look here |
|------|---------|-------------------|
| `server.ts` | HTTP server bootstrap | Understanding how app starts |
| `nara` (CLI) | Command-line interface | Running generators, migrations |
| `routes/web.ts` | Route definitions | Understanding URL structure |
| `app/core/App.ts` | Application kernel | Understanding middleware, error handling |
| `app/core/BaseController.ts` | Base controller class | Understanding controller patterns |
| `app/core/BaseModel.ts` | Base model class | Understanding database patterns |

## Directory Map

```
nara/
├── app/                    # Application source code
│   ├── core/              # Framework kernel (App, Router, BaseController)
│   ├── controllers/       # HTTP handlers (extend BaseController)
│   ├── models/            # Database models (extend BaseModel)
│   ├── services/          # Business logic (DB, Logger, Auth, Storage)
│   ├── middlewares/       # HTTP middleware (auth, csrf, rateLimit)
│   ├── validators/        # Input validation (custom, no Zod)
│   ├── events/            # Event dispatcher system
│   ├── authorization/     # RBAC (Gates, Policies)
│   ├── config/            # Environment & constants
│   └── helpers/           # Utilities
├── commands/native/        # CLI generators (22 commands)
├── routes/                 # Route definitions (web.ts)
├── migrations/             # Knex database migrations
├── database/               # SQLite files, factories, seeds
├── resources/js/           # Svelte 5 frontend
│   ├── Pages/             # Route pages (.svelte)
│   ├── Components/        # Reusable components
│   └── lib/               # Utilities (api.ts, csrf.ts, toast.ts)
├── tests/                  # Vitest unit tests
└── public/                 # Static assets
```

## Two Response Types (CRITICAL)

Every route returns **either** Inertia **or** JSON — never mix:

| Route Type | Called By | Returns | Example Method |
|------------|-----------|---------|----------------|
| Page | Browser navigation | `res.inertia("PageName")` | `page()`, `usersPage()` |
| Data | `axios` from Svelte | `jsonSuccess()`, `jsonPaginated()` | `index()`, `store()`, `update()` |

## Path Aliases

| Alias | Resolves To |
|-------|-------------|
| `@core` | `app/core/index.ts` |
| `@controllers` | `app/controllers/index.ts` |
| `@models` | `app/models/index.ts` |
| `@services` | `app/services/index.ts` |
| `@middlewares` | `app/middlewares/index.ts` |
| `@validators` | `app/validators/index.ts` |
| `@events` | `app/events/index.ts` |
| `@config` | `app/config/index.ts` |
| `$lib` | `resources/js/lib` |

## Key Patterns

### Controller
```typescript
class PostController extends BaseController {
  async page(req, res) {
    this.requireInertia(res);
    return res.inertia("posts/Index");  // Page route
  }
  
  async index(req, res) {
    this.requireAuth(req);
    const data = await Post.findAll();
    return jsonSuccess(res, "OK", data);  // Data route
  }
}
```

### Model
```typescript
class PostModel extends BaseModel<PostRecord> {
  protected tableName = "posts";
  
  async findByUserId(userId: string) {
    return this.query().where("user_id", userId);
  }
}
export const Post = new PostModel();
```

### Frontend (Svelte 5)
```svelte
<script lang="ts">
  import axios from 'axios';
  import { api } from '$lib/api';
  
  let posts = $state([]);
  
  async function loadPosts() {
    const result = await api(() => axios.get('/posts/data'), { showSuccessToast: false });
    if (result.success) posts = result.data;
  }
</script>
```

## Validation (No External Libraries)

This project uses **custom validators** — NOT Zod, Yup, or Joi.

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

## CLI Commands

```bash
# Generators
node nara make:controller PostController
node nara make:model Post
node nara make:migration create_posts_table
node nara make:validator CreatePost

# Database
node nara db:migrate
node nara db:rollback
node nara db:seed
node nara db:fresh --seed

# Development
node nara doctor          # Health check
node nara generate:types  # Sync types to frontend
```

## Detailed Documentation

Each directory has an `AGENTS.md` file with detailed patterns:

- [`AGENTS.md`](./AGENTS.md) - Root knowledge base with Mental Model
- [`app/AGENTS.md`](./app/AGENTS.md) - Module overview
- [`app/core/AGENTS.md`](./app/core/AGENTS.md) - Framework kernel
- [`app/controllers/AGENTS.md`](./app/controllers/AGENTS.md) - Controllers
- [`app/models/AGENTS.md`](./app/models/AGENTS.md) - Models
- [`resources/js/AGENTS.md`](./resources/js/AGENTS.md) - Frontend

## Anti-Patterns (DO NOT)

1. Use Zod/Yup/Joi → use `@validators`
2. Use bcrypt directly → use `Authenticate.hash()`
3. Use relative imports → use `@core`, `@models`, etc.
4. Return JSON from page route → causes Inertia error
5. Pass CRUD data via `res.inertia()` → data goes stale
6. Use raw `fetch()` → use `api(() => axios.method())`

## Environment

```env
NODE_ENV=development
PORT=5555
DB_FILE=database/dev.sqlite3
LOG_LEVEL=debug
```

See `.env.example` for all variables.
