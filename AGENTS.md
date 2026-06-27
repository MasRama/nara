---
authority: canon
owner: masrama
last_verified: 2026-06-28
scope: root
---

# Nara - Project Knowledge Base

> **Authority:** canon — current source of truth. Agents must follow this.
> **Skills:** Deep-dive procedures live in [`.agents/skills/`](./.agents/skills/SKILL.md) — load on demand.

## AI Quickstart — First time here?

Read in this order (each builds on the previous):

1. **[CODEMAP.md](./CODEMAP.md)** — codebase topology in one read (111 files, 278 exports). Know what exists before searching.
2. **[ROUTES.md](./ROUTES.md)** — API surface in one read (26 routes, all methods + paths + middleware + handlers).
3. **This file** — conventions, anti-patterns, dependency policy, structure. ~250 lines.
4. **[`.agents/skills/SKILL.md`](./.agents/skills/SKILL.md)** — skill index. Load relevant skill when touching that pattern.
5. **[`docs/decisions/`](./docs/decisions/README.md)** — ADRs explain WHY decisions were made. Read when questioning a convention.

Then verify your work with one command:
```bash
npm run check    # lint + typecheck + layer lint + tests + freshness
```

Scaffold a new resource with one command:
```bash
npm run gen:resource products -- --fields="name:string,price:number"
```

## Overview

AI-first TypeScript full-stack starter kit. Functions over classes, raw SQL over ORM, minimal abstractions.

- **Backend**: ultimate-express (uWebSockets.js) + better-sqlite3
- **Frontend**: Svelte 5 + Inertia.js + Zag JS (headless UI)
- **Auth**: Session-based + Google OAuth + RBAC
- **Validation**: Zod

## Philosophy

- **No classes** — functions only
- **No unnecessary comments** — code is self-documenting
- **No abstractions** — inline is fine
- **Raw SQL** — AI writes SQL, we just execute it
- **Minimal code** — less code = less bugs

## Mental Model

```
Browser (Svelte 5 + Inertia)
  │  router.visit() for pages · axios for data
  ▼
Server (ultimate-express)
  │  Request → Middleware → Router → Handler → Response
  │
  ├── handlers/   (request handlers — functions)
  ├── queries/    (raw SQL functions)
  ├── services/   (SQLite, Auth, Logger, Storage, CacheStore)
  ├── middlewares/ (auth, csrf, rateLimit, securityHeaders)
  ├── validators/ (Zod schemas)
  ├── config/     (env + constants)
  └── types/      (interfaces)
```

### Two Response Types

| Route Type | Called By | Returns |
|---|---|---|
| **Page** | Browser navigation | `res.inertia('pageName', { data })` |
| **Data** | `axios` from Svelte | `jsonSuccess()`, `jsonError()`, `jsonCreated()` |

## Structure

```
./
├── app/
│   ├── types/           # Interfaces (User, Session, Role, Permission)
│   ├── queries/         # Raw SQL functions (findUserById, createUser, isAdmin)
│   ├── handlers/        # Request handlers (functions, not classes)
│   ├── services/        # SQLite, Logger, Auth, Storage, CacheStore, LoginThrottle
│   ├── middlewares/      # auth, csrf, rateLimit, securityHeaders, inputSanitize, requestId
│   ├── validators/      # Zod schemas + zodToErrors helper
│   ├── config/          # Environment (env.ts) & constants (constants.ts)
│   └── core/            # App, Router, errors, response helpers
├── routes/web.ts        # All route definitions
├── migrations/          # TypeScript migrations (raw SQL strings, up/down exports)
├── seeds/               # TypeScript seeds (run(SQLite) function exports)
├── resources/             # Frontend (Svelte 5 + Inertia)
│   ├── inertia.html       # HTML template (served by View.ts)
│   ├── app.ts             # Inertia app entry point
│   ├── index.css          # Global styles + Tailwind
│   ├── Pages/             # Route pages (.svelte)
│   ├── Components/        # Reusable components (Header, Button, Switch, Modal, etc — Zag JS for interactive UI)
│   ├── lib/               # api.ts, csrf.ts, toast.ts, utils.ts (cn), utils/
│   └── types/             # generated.ts + index.ts (manually synced with backend)
├── tests/               # Vitest tests
├── server.ts            # Entry point
└── database/            # SQLite database files (dev.sqlite3, production.sqlite3)
```

## Skills (load on demand)

| Skill | When to load |
|---|---|
| [`.agents/skills/crud-pattern.md`](./.agents/skills/crud-pattern.md) | Adding a new resource (full stack) |
| [`.agents/skills/sqlite-usage.md`](./.agents/skills/sqlite-usage.md) | Writing SQL queries, transactions |
| [`.agents/skills/auth-rbac.md`](./.agents/skills/auth-rbac.md) | Auth guards, permission checks |
| [`.agents/skills/inertia-patterns.md`](./.agents/skills/inertia-patterns.md) | Frontend pages, navigation, API calls |
| [`.agents/skills/error-handling.md`](./.agents/skills/error-handling.md) | Error responses, validation |

## Database Schema

| Table | Key Columns | Relations |
|---|---|---|
| `users` | id (uuid), email, name, password, avatar | has many roles via `user_roles` |
| `sessions` | id (uuid), user_id, user_agent, expires_at | belongs to `users` |
| `roles` | id (uuid), name, slug, description | has many permissions via `role_permissions` |
| `permissions` | id (uuid), name, slug, resource, action, description | belongs to roles via `role_permissions` |
| `user_roles` | id (uuid), user_id, role_id, created_at | junction: `users` ↔ `roles` |
| `role_permissions` | id (uuid), role_id, permission_id, created_at | junction: `roles` ↔ `permissions` |
| `assets` | id (uuid), name, type, url, mime_type, size, s3_key, user_id | belongs to `users` |
| `password_reset_tokens` | id (auto), email, token, expires_at, used | standalone |

- All IDs: `crypto.randomUUID()` (except auto-increment tables)
- All timestamps: `biginteger` unix milliseconds via `Date.now()`
- Foreign keys: `.onDelete('CASCADE')`

## Middleware

| Middleware | Import | Effect |
|---|---|---|
| `Auth` | `@middlewares/auth` | Requires session, loads user + roles + permissions |
| `strictRateLimit()` | `@middlewares/rateLimit` | 10 req/min per IP |
| `csrf()` | `@middlewares/csrf` | Double Submit Cookie CSRF protection |
| `securityHeaders()` | `@middlewares/securityHeaders` | HSTS, CSP, X-Frame-Options |
| `inputSanitize()` | `@middlewares/inputSanitize` | XSS protection via DOMPurify |
| `requestId()` | `@middlewares/requestId` | Adds `req.requestId` for tracing |
| `requestLogger()` | `@middlewares/requestLogger` | Logs requests via Logger |

## Conventions

- **2-space indent** (.editorconfig)
- **Strict TypeScript** (strict: true)
- **Path aliases** — `@core`, `@queries`, `@services`, `@middlewares/*`, `@handlers/*`, `@types`, `@validators`, `@config`
- **Password hashing** — `hashPassword()` / `comparePassword()` from `@services/Authenticate`
- **Constants** — use `@config/constants` (SERVER, AUTH, RATE_LIMIT, UPLOAD, CACHE, LOGGING)
- **IDs** — `crypto.randomUUID()` for all new records

## Dependency Policy

AI must not add dependencies without checking this table. If a category is "Banned", suggest the allowed alternative instead.

| Category | Allowed | Banned | Why |
|---|---|---|---|
| Database | `better-sqlite3` | Prisma, Drizzle, Knex, Sequelize, TypeORM | ADR 0001 — raw SQL, AI writes SQL fluently |
| Framework | `ultimate-express` | Express, Fastify, Koa, Hono | Nara uses uWebSockets.js for performance |
| Frontend | `svelte`, `@inertiajs/svelte` | React, Vue, Solid, Angular | ADR 0003 — Inertia + Svelte 5 |
| UI primitives | `@zag-js/*` | Headless UI, Radix, Melt | ADR 0007 — framework-agnostic state machines |
| Validation | `zod` | Joi, Yup, class-validator, valibot | ADR 0006 — TypeScript-first, type inference |
| Auth | `@services/Authenticate` (internal) | bcrypt (direct), passport, jsonwebtoken | ADR 0005 — session-based, internal wrapper |
| HTTP client | `axios` | fetch (in frontend), got, node-fetch | `api()` wrapper handles CSRF + toast |
| Logging | `pino` (via `@services/Logger`) | winston, morgan, console.log | Structured logging, file rotation built-in |
| Styling | `tailwindcss`, `clsx`, `tailwind-merge`, `tailwind-variants` | styled-components, emotion, CSS modules | Utility-first, AI generates Tailwind fluently |
| Icons | `@lucide/svelte` | heroicons, feather-icons, font-awesome | Tree-shakeable, consistent API |
| Image processing | `sharp` | jimp, canvas, gm | Native binding, fast |
| File upload | `multer` | formidable, busboy | Memory storage + sharp pipeline |
| State (frontend) | Svelte 5 runes (`$state`, `$derived`, `$effect`) | Redux, Zustand, Pinia, Svelte stores | ADR 0003 — server is source of truth |
| Testing | `vitest` | jest, mocha, jasmine | Vite-native, fast, ESM support |
| Date/time | native `Date`, `Intl` | moment, dayjs, date-fns | Standard library sufficient |
| Utils | native `crypto`, `path`, `fs` | lodash, underscore, ramda | Standard library sufficient |

### Adding a new dependency

1. Check if the category is in the table above
2. Check if the need can be met with the allowed dependency or standard library
3. If a new dependency is truly needed, add it to `package.json`, update this table, and add an ADR explaining why

## Anti-Patterns

1. **Don't** use classes — use functions
2. **Don't** use ORM/query builder — write raw SQL in `queries/`
3. **Don't** return `jsonSuccess` from a page route — use `res.inertia()`
4. **Don't** return `inertia()` from a data route — use `jsonSuccess/jsonError`
5. **Don't** use relative imports for core modules — use path aliases
6. **Don't** use `console.log` — use `Logger.info/warn/error`
7. **Don't** use `fetch()` on frontend — use `api(() => axios.method(...))`
8. **Don't** use bcrypt directly — use `hashPassword()` from `@services/Authenticate`
9. **Don't** mix languages in error messages — use Indonesian for user-facing messages
10. **Don't** use generic handler names (`index`, `store`, `create`, `update`, `destroy`) — use descriptive names (`createUser`, `updateRole`, `listRoles`)
11. **Don't** use vague function names (`handle`, `process`, `run`, `do`, `execute` as standalone) — describe what it does (`processPayment`, `handleWebhookDelivery`)

## Build/Test

```bash
npm run dev          # Dev server (Vite + nodemon)
npm run build        # Production build
npm run lint         # tsc --noEmit
npm run test         # vitest run
npm run migrate      # Run pending migrations (ts-node + raw SQL)
npm run seed         # Run seeders
```

## Agent Tooling

Nara ships with agent-ergonomic tooling. Run these before committing AI-generated code.

| Command | Purpose | Blocks commit? |
|---|---|---|
| `npm run check` | All-in-one: lint + typecheck + lint:layers + tests + freshness | No (run manually) |
| `npm run codemap` | Regenerate `CODEMAP.md` (codebase topology index) | No |
| `npm run gen:routes` | Regenerate `ROUTES.md` (API surface catalog) | No |
| `npm run gen:resource <name> -- --fields="..."` | Scaffold a full-stack resource (6 files) | No |
| `npm run lint:layers` | Enforce 17 layer boundary + naming + import direction rules | Yes (pre-commit) |
| `npm run check:freshness` | Check if AGENTS.md files are stale relative to code | No (advisory) |
| `npm run check:freshness -- --strict` | Same, but fail CI on stale AGENTS.md | Yes (in CI) |

### CODEMAP.md

Auto-generated index of files, exports, and import graph. Read this BEFORE searching the codebase — it gives topology in one read (~750 tokens). Regenerate after large changes:

```bash
npm run codemap
```

### ROUTES.md

Auto-generated catalog of all routes: method, path, middleware, handler. Read this to understand the API surface in one pass. Regenerate after adding/changing routes:

```bash
npm run gen:routes
```

### Resource Generator

Scaffold a full-stack resource (types → migration → queries → validator → handler → route → page) following all conventions:

```bash
npm run gen:resource products -- --fields="name:string,price:number"
```

Generates 6+ files with correct naming (ADR 0009), raw SQL (ADR 0001), functions (ADR 0002), and descriptive handler names. Zero structural mistakes possible.

### Layer Boundary Lint

Enforces 17 rules from AGENTS.md anti-patterns + import direction:
- L1-L10: anti-patterns (no SQLite in handlers, no fetch in frontend, no console.log, etc.)
- L11-L13: naming conventions (no generic names, include resource, no vague functions)
- L14-L17: import direction (queries → types only, services → core only, validators → types+zod only, middlewares → core+queries only)

See `scripts/lint-layers.ts` for the full rule list.

### Freshness Gate

If code in a directory changes but its AGENTS.md is not updated, the freshness gate warns. Advisory by default, strict in CI. See `scripts/check-freshness.ts` for the directory→AGENTS.md mapping.

### Pre-commit Hook

Install with:
```bash
cp scripts/pre-commit .git/hooks/pre-commit && chmod +x .git/hooks/pre-commit
```

Runs layer lint (blocking) + freshness check (advisory) on every commit.

## Where to Look

| Task | Location | Skill |
|---|---|---|
| Add new endpoint | `app/handlers/` + `routes/web.ts` | [`crud-pattern.md`](./.agents/skills/crud-pattern.md) |
| Add database query | `app/queries/` | [`sqlite-usage.md`](./.agents/skills/sqlite-usage.md) |
| Add data model | `app/types/models.ts` + `migrations/` | [`crud-pattern.md`](./.agents/skills/crud-pattern.md) |
| Add Zod schema | `app/validators/schemas.ts` + export from `index.ts` | [`error-handling.md`](./.agents/skills/error-handling.md) |
| Auth logic | `app/services/Authenticate.ts` | [`auth-rbac.md`](./.agents/skills/auth-rbac.md) |
| Permission checks | `app/queries/users.ts` (isAdmin, hasPermission) | [`auth-rbac.md`](./.agents/skills/auth-rbac.md) |
| File upload | `app/handlers/assets.ts` (multer + sharp + Storage) | — |
| Frontend page | `resources/Pages/` | [`inertia-patterns.md`](./.agents/skills/inertia-patterns.md) |
| Frontend component | `resources/Components/` | — |
| Constants | `app/config/constants.ts` | — |
| Adapters | `app/core/adapters/` (Svelte/Inertia integration) | — |
