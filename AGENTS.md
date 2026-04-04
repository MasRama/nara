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
├── commands/native/        # CLI generators (21 commands)
├── routes/                 # Web routes
├── database/
│   ├── factories/         # Model factories (faker)
│   ├── migrations/       # Knex migrations
│   └── seeds/             # Seeders
├── resources/js/          # Svelte 5 frontend
├── migrations/            # Root migrations
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

## Anti-Patterns (DO NOT)

1. Use Zod/Yup/Joi for validation → use `@validators`
2. Manual bcrypt hash → use `Authenticate.hash()`
3. Relative imports for core modules → use `@core`
4. Forget BaseController extends → auto-binding breaks
5. Forget BaseModel<T> extends → CRUD methods unavailable

## Key Patterns

| Pattern | Location |
|---------|----------|
| Controller | `app/controllers/*.ts` - extend `BaseController` |
| Model | `app/models/*.ts` - extend `BaseModel<T>`, define `tableName` |
| Middleware | `app/middlewares/*.ts` - function(req, res, next) |
| Form Request | `app/http/requests/*.ts` - authorize() + rules() |
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
