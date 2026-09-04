# Nara v2 Implementation Inventory

Reference point for the v3 rewrite. This inventory records the current v2 implementation without changing its architecture.

- v2 reference branch: `main`
- v2 reference HEAD: `ccddb94724302acf55e8d640d1df76dda2462126`
- v3 work branch: `v3`
- Current v2 package version: `2.1.0`

## Inventory

| Area | Category | Current v2 implementation | v3 treatment |
|---|---|---|---|
| Application entrypoint | REIMPLEMENT | `server.ts` creates `createWebApp`, mounts `routes/web.ts`, and starts the server. | Compose the application under the v3 `src/app` layer. |
| HTTP engine | REMOVE | `ultimate-express@2.1.1` is used by `app/core/App.ts` and `app/core/Router.ts`. | Remove the dependency and all uWS-specific assumptions. |
| uWebSockets.js workaround | REMOVE | The v2 HTTP dependency chain carries the native uWS deployment risk. | No uWebSockets.js or native HTTP workaround in the v3 runtime path. |
| HTTP framework and adapter | REIMPLEMENT | Express-compatible app/router APIs are used throughout the v2 core. | Use Hono with `@hono/node-server` and standard `node:http` composition, without a Nara HTTP wrapper. |
| Route composition | REIMPLEMENT | `routes/web.ts` is one global route file for pages, auth, users, roles, assets, health, and 404 handling. | Move route ownership into features and compose feature routes in the app layer. |
| Frontend framework | REIMPLEMENT | Svelte 5 with runes and `@inertiajs/svelte`; entrypoint is `resources/app.ts`. | Replace with locked Vue 3 + Vite + TypeScript; preserve useful behavior, not Svelte implementation details. |
| Frontend styling and UI | REIMPLEMENT | Tailwind CSS, Bits UI, Lucide Svelte, `mode-watcher`, and `svelte-sonner`. | Keep useful Tailwind styling; replace Svelte-specific UI/runtime integrations with direct Vue composition. |
| Frontend API access | REIMPLEMENT | `resources/lib/api.ts` provides a generic `fetch` wrapper with CSRF headers, response parsing, and toasts. | Adapt to feature-scoped contracts/clients; do not introduce a global RPC type. |
| Database | PRESERVE | `better-sqlite3` with SQLite files under `database/`; tests use `:memory:`. | Keep SQLite and adapt database access to shared or feature-owned v3 locations. |
| Query layer | REIMPLEMENT | Raw SQL functions are split across `app/queries/*.ts` and imported by handlers/services. | Keep raw SQL behavior where useful, but place ownership inside features or intentionally small shared code. |
| Migrations | PRESERVE | TypeScript migrations in `migrations/` create `users`, `sessions`, `assets`, RBAC tables, and the migration ledger. | Preserve schema behavior with forward-only SQL migrations under owning Features, checksummed in `_nara_migrations`. |
| Seeds | PRESERVE | `seeds/` creates permissions, roles, and the initial admin user. | Preserve permissions, roles, and role relationships under Feature-owned idempotent seeds; replace the insecure admin seed with explicit bootstrap credentials. |
| Authentication | REIMPLEMENT | Session-cookie authentication in `app/services/Authenticate.ts`; PBKDF2-SHA512 password hashing; login throttling; logout; password change. | Reimplement as a feature-owned capability with a public interface. Preserve session semantics unless a task says otherwise. |
| Authorization / RBAC | REIMPLEMENT | Users, roles, permissions, `user_roles`, and `role_permissions`; permission checks live in query functions and handlers. | Reimplement with explicit feature ownership and public cross-feature access only. |
| Configuration | REIMPLEMENT | Zod validation in `app/config/env.ts` loads `.env.production` or `.env`; constants are in `app/config/constants.ts`. | Preserve useful environment behavior under `src/shared/config` or another spec-compliant shared location. |
| Logging | PRESERVE | Pino transports to console/file and rolling `logs/` files; helpers include request, auth, and security events. | Retain Pino-based behavior through a small shared logging facility. |
| Error and response handling | REIMPLEMENT | Express response helpers return success/error/validation/paginated JSON; `App.ts` hides unexpected errors in production. | Use Hono-native mechanisms where adequate and keep expected, validation, and unexpected errors distinct. |
| Security middleware | PRESERVE | Security headers/CSP, CSRF double-submit cookies, request IDs, input sanitization, request logging, and rate limiting. | Preserve effective protections and adapt middleware to Hono; remove Express-specific implementations. |
| File upload and storage | REIMPLEMENT | Authenticated avatar upload uses Multer memory storage, magic-byte checks, Sharp WebP conversion, `Storage`, and asset records. Static/public serving includes traversal and symlink checks. | Reimplement as a feature-owned capability if retained; preserve security behavior and storage semantics. |
| Views and page rendering | REIMPLEMENT | `View.ts`, renderer middleware, Inertia Svelte pages, and a global page route surface render landing, auth, dashboard, users, roles, profile, and errors. | Migrate useful browser behavior to Vue feature-owned web surfaces; do not preserve the Svelte implementation. |
| Validation | PRESERVE | Zod schemas cover auth, users, roles, profile, and bulk deletion; `zodToErrors` maps issues to API errors. | Keep Zod and move validation/contracts into feature boundaries. |
| Tests | PRESERVE | Vitest tests cover handlers, queries, middleware, services, validators, core response/router behavior, and frontend API utilities; `jsdom` is the test environment. | Keep Vitest and add v3 architecture/fixture tests as required by later TODO tasks. |
| Build and package tooling | REIMPLEMENT | npm, TypeScript 5.6, Vite, Svelte plugin, `tsc`, `tsc-alias`, ts-node, nodemon, and Vitest. | Keep npm, TypeScript, Vite, ts-node, nodemon, and Vitest where compatible; replace Svelte tooling with the locked Vue plugin and Vue-aware typecheck. |
| Technical-layer directories | REMOVE | Business code is primarily organized under `app/handlers`, `app/queries`, `app/services`, `app/middlewares`, `app/validators`, `app/config`, and `app/core`. | Do not make these global technical layers the v3 target; migrate ownership into `features/`, `shared/`, and `app/`. |

## Current route and capability surface

`routes/web.ts` currently exposes:

- Public landing, health, readiness, static assets, and 404 routes.
- Login, registration, logout, and password-change flows.
- Dashboard, users, profile, user CRUD, and avatar upload flows.
- Role and permission listing, role CRUD, and RBAC checks.

The reusable business capabilities to account for during migration are:

1. authentication and sessions
2. users and profiles
3. roles, permissions, and RBAC
4. avatar/assets and local storage
5. health/readiness checks
6. frontend page rendering and navigation

## Current database schema

| Table | Purpose |
|---|---|
| `users` | User identity, credentials, avatar, and timestamps. |
| `sessions` | Session tokens, user association, user agent, and expiry. |
| `assets` | Stored asset metadata and optional user ownership. |
| `roles` | RBAC roles. |
| `permissions` | Resource/action permissions. |
| `user_roles` | User-to-role junction with cascading foreign keys. |
| `role_permissions` | Role-to-permission junction with cascading foreign keys. |
| `_nara_migrations` | Checksummed forward migration ledger managed by the v3 migrator. |

## Environment variables

The current configuration reads or uses:

- `NODE_ENV`: `development`, `production`, or `test`.
- `PORT`: HTTP server port; defaults to `5555`.
- `VITE_PORT`: Vite development port; defaults to `5173`.
- `APP_URL`: public browser-facing application origin; defaults to the Vite URL in development and is required in production.
- `DB_FILE`: optional SQLite path; defaults by environment.
- `LOG_LEVEL`: Pino level; defaults by environment.
- `LOG_PRETTY`: optional pretty-console toggle.
- `TITLE`: optional renderer title currently read directly by the renderer and not validated by the config schema.

## Current v3 migration status

The required server capabilities migrated so far are:

| v2 capability | v3 owner | Verified behavior |
|---|---|---|
| Authentication and sessions | `src/features/auth` | Registration, login, session lookup, logout, password change, and validation are covered by feature integration tests. |
| User administration and profile | `src/features/users` | Authenticated profile access/update, admin CRUD, pagination/search, and validation are covered by feature integration tests. |
| Roles, permissions, and RBAC | `src/features/auth` | Auth-owned role/permission checks and protected role management are covered by feature integration tests. |
| Avatar assets | `src/features/users` | MIME/magic-byte validation, bounded WebP processing, storage, serving, and unauthenticated rejection are covered by feature integration tests. |
| Health and readiness | `official-features/health` and `src/app` | Health composition and database readiness are covered by application integration tests. |

The v3 entrypoint is `src/app/server.ts` and composes only v3 feature exports. The Vue shell is bootstrapped by `resources/app.ts` and `src/app/App.vue`; the auth login surface lives under `src/features/auth/web/pages/`. Legacy v2 Svelte pages are not active.

## Migration matrix: capability to Feature ownership

The v2 business surface maps to these v3 Feature owners. Platform concerns support Features but are not promoted to Features themselves.

| v2 capability | Target v3 Feature | Supporting v3 location | Status |
|---|---|---|---|
| Authentication, sessions, login, registration, logout, and password change | `auth` | `src/features/auth/server` and `src/shared/database` | Migrated and tested |
| User CRUD and profile read/update | `users` | `src/features/users/server` and `src/shared/database` | Migrated and tested |
| Roles, permissions, and RBAC checks | `auth` | `src/features/auth/server` public authorization exports and `src/shared/database` | Migrated and tested |
| Avatar upload and user-owned asset metadata | `users` | `src/features/users/server` plus `src/shared/database` storage records | Migrated and tested |
| Health and readiness endpoints | `health` | `official-features/health` composed by `src/app/server.ts` plus the app readiness probe | Migrated and tested |
| Frontend pages and navigation | Owning Feature (`auth`, `users`, or a later business Feature) | Vue shell in `resources/app.ts` and `src/app/App.vue`; feature pages under owning `web/` directories | Migrated and typechecked; useful shell behavior is covered by the Vue frontend smoke test. |

The target owner is the business concept, not the v2 technical layer. Shared code is limited to infrastructure such as configuration, logging, errors, database access, and storage mechanics; it does not own the capabilities above.

## Explicit v3 removals

The following v2 runtime elements are intentionally not preserved:

- `ultimate-express`
- `uWebSockets.js` and any native uWS workaround/configuration
- Express-compatible Nara HTTP abstractions as the v3 server boundary
- Global technical-layer organization as the primary application model

This file is an inventory only. It does not define new v3 architecture beyond the decisions closed in `ARCHITECTURE.md` (rewrite-era record: `docs/archive/v3/rewrite-spec.md`).
