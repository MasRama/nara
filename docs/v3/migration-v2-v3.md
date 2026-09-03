# Migrating from Nara v2 to v3

Nara v3 is a new architecture. No automatic source migration is promised.

Treat v2 code as a capability inventory and port each capability deliberately into a v3 Feature. Do not expect v2 imports, route handlers, middleware, migrations, or UI pages to work unchanged.

## The architectural change

Nara v2 organizes business code by technical layer:

```text
app/types/
app/validators/
app/queries/
app/services/
app/handlers/
routes/web.ts
resources/Pages/
```

Nara v3 organizes the same business capability by Feature:

```text
src/features/<feature>/
├── contract.ts
├── index.ts
├── server/
├── web/       # optional
└── tests/
```

The mapping is ownership-based, not a mechanical directory rename:

| v2 capability or layer | v3 destination | Migration note |
|---|---|---|
| `handlers/`, `queries/`, service code for authentication | `src/features/auth/server/` | Keep the capability together; expose only required operations from `auth/index.ts`. |
| user profile, administration, and avatar behavior | `src/features/users/` | Persistence and HTTP behavior remain inside the Feature. |
| role, permission, and access policy code | `src/features/auth/` | RBAC is part of the auth capability, not a global access layer. |
| request schemas and response DTOs | Feature `contract.ts` | Validators and boundary types share one Feature-owned contract. |
| shared SQLite connection | `src/shared/database/` | Infrastructure remains shared; business queries do not become global. |
| environment and constants | `src/shared/config/` | Keep configuration infrastructure separate from business policy. |
| logger and application errors | `src/shared/logging/` and `src/shared/errors/` | These are cross-cutting infrastructure, not Feature ownership. |
| page/component/API client code | owning Feature `web/` | `web/` is optional; port browser code only when the capability needs it. |
| global route table | `src/app/server.ts` plus Feature public route exports | Application composition mounts Features; it does not reach into internals. |

## HTTP engine replacement

V3 uses Hono on Node:

```text
@hono/node-server → Hono → Feature route sub-applications
```

V2's Ultimate Express / uWebSockets.js path and its Express-compatible request/response wrappers are not part of v3. Replace code that depends on:

- `NaraRequest` and `NaraResponse`
- `Route.get/post/put/delete`
- `res.inertia(...)`
- `jsonSuccess(...)` and related Express response helpers
- Express middleware arrays and `next()` conventions
- Ultimate Express or uWebSockets.js startup options

A v3 route uses Hono's context and is composed through a public Feature export:

```ts
import { Hono } from 'hono';

export const healthRoutes = new Hono().get('/', (context) =>
  context.json({ status: 'ok' as const }),
);
```

```ts
import { authRoutes } from '@/features/auth';

app.route('/api/auth', authRoutes);
```

The replacement removes the old native HTTP compatibility workaround. The Nara HTTP layer is JavaScript/TypeScript on Node through `@hono/node-server`; there is no uWebSockets.js binary to load and no Nara-specific `GLIBC_2.38` requirement.

## Data and persistence

V3 uses SQLite through `better-sqlite3` and raw SQL. The connection layer only opens and configures the local database file. Feature-owned SQL migrations under `src/features/<feature>/server/migrations/` evolve the schema forward; the migration engine does not provide production rollback/down migrations.

Before moving a deployed application:

1. back up the v2 database
2. inventory tables, indexes, constraints, and data transforms
3. compare them with the v3 schema and migration ledger used by the owning Features
4. write and test an explicit data migration or export/import process
5. validate users, sessions, roles, permissions, and assets before cutover

An existing v3 development database created by the former `sqlite.ts` bootstrap is recognized only when all expected tables, columns, indexes, and foreign keys match exactly; Nara then records the canonical baseline checksums without rewriting data. Partial or different schemas are left untouched and require a corrective forward migration. V2 `migrations` history is not silently translated.

Do not delete a production database or assume that a fresh v3 schema preserves existing data. A source port and a data migration are separate deliverables.

## Suggested porting process

### 1. Start a v3 target

For a new application, generate the minimal target:

```bash
nara new my-app
cd my-app
npm install
```

For an existing repository, create a v3 branch or a clean target directory. Read [`V3_SPEC.md`](../../V3_SPEC.md) and [`AGENTS.md`](../../AGENTS.md) before copying code.

### 2. Inventory capabilities

List user-visible and operational capabilities, not v2 files:

```text
authentication and sessions
user profiles and administration
roles, permissions, and access checks
avatar upload and delivery
health and readiness
frontend pages and navigation
```

Choose one owning Feature per capability. The v2-to-v3 inventory is recorded in [`v2-inventory.md`](./v2-inventory.md).

### 3. Port the contract first

Create `contract.ts` with request schemas and boundary-safe response types. Keep validation at the HTTP boundary and avoid recreating a global validators directory.

### 4. Port server behavior inside the Feature

Move persistence into the Feature's `server/repository.ts`, business behavior into a Feature service when needed, and Hono routes into `server/routes.ts`. Use `src/shared/database` and `src/shared/logging` only for infrastructure.

### 5. Expose a narrow public boundary

Export routes, safe operations, schemas, and types from `index.ts`. Migrate every consumer to the public boundary. Never preserve a direct import to another Feature's `server/` implementation as a compatibility shortcut.

### 6. Compose the application

Mount the Feature's public route export in `src/app/server.ts`. Keep health/readiness and HTTP composition there; keep business decisions in Features.

### 7. Port web code intentionally

Move browser code to the owning Feature's `web/` directory. Reuse `contract.ts` types where safe. Do not import server repositories, database access, Node built-ins, or server-only packages from `web/`.

### 8. Port data explicitly

Run the tested database migration or import process planned in step 2. Verify password hashes, session invalidation, role assignments, and stored asset paths as separate acceptance checks.

### 9. Verify each capability

Use behavior tests and the architecture engine:

```bash
npm run lint
npm test
nara doctor
nara inspect auth --json
nara context users --json
```

Run the production build and a health/readiness smoke test before cutover:

```bash
npm run build
npm start
```

## What is not a migration strategy

These shortcuts leave v2 architecture baggage behind and are not supported:

- keeping `app/` as a second production implementation beside `src/`
- adding aliases that preserve imports into deleted v2 layers
- wrapping Hono in an Express-compatible adapter
- moving files without assigning Feature ownership
- putting all former queries or services into `src/shared/`
- copying pages while retaining a global v2 route table
- importing Feature internals because the public index is inconvenient
- assuming SQLite table creation is a production data migration

A clean v3 cutover removes duplicate production paths after parity is verified. Historical migration notes may remain as documentation; obsolete runtime code and compatibility shims should not.

## Cutover checklist

- [ ] every required capability has one v3 Feature owner
- [ ] each Feature has a public `index.ts`
- [ ] cross-Feature imports use public boundaries only
- [ ] contracts and runtime validation live with their Feature
- [ ] browser code has no server-only imports
- [ ] v2 HTTP wrappers and uWS dependencies are removed
- [ ] database and asset data migration is tested separately
- [ ] Feature behavior tests pass
- [ ] `nara doctor` passes
- [ ] production build and `/health`/`/ready` smoke tests pass
