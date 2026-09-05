# Nara v3 Feature Architecture

A Feature is one business capability and the primary unit of application organization. Its public contract, runtime behavior, optional web surface, and tests stay together.

This arrangement is deliberate: a person or coding agent can find the complete change surface from one directory, while Nara can validate the boundaries from ordinary TypeScript files. Technical layers still exist inside a Feature; they do not own the application globally.

## Canonical structure

Features live under `src/features/<feature>/`. Names are lowercase kebab-case business names such as `auth`, `users`, and `billing`.

```text
src/features/billing/
├── contract.ts       # feature-owned types and runtime input schemas
├── index.ts          # general/server-facing public boundary
├── server/           # routes, services, repositories, adapters
│   ├── migrations/   # optional plain SQL schema evolution
│   └── seeds/        # optional idempotent reference data
├── web/              # optional browser code and typed API client
│   └── index.ts      # optional browser-safe public boundary
└── tests/            # feature behavior tests
```

Only files required by the capability need to exist. A backend-only Feature does not need `web/`; a small capability may contain only `contract.ts` and `index.ts`.

The current application uses these Feature surfaces:

```text
src/features/auth/
├── contract.ts
├── index.ts
├── server/
│   ├── access-routes.ts
│   ├── access.ts
│   ├── migrations/
│   ├── repository.ts
│   ├── routes.ts
│   ├── seeds/
│   └── service.ts
├── tests/
└── web/
    ├── client.ts
    ├── index.ts      # browser-safe public boundary
    ├── pages/
    └── session.ts

src/features/users/
├── contract.ts
├── index.ts
├── server/
│   ├── assets-routes.ts
│   ├── assets.ts
│   ├── migrations/
│   ├── repository.ts
│   └── routes.ts
└── tests/
```

`src/app/server.ts` composes public route exports. It does not reach into a Feature's repository or service:

```ts
import { authRoutes } from '@/features/auth';
import { userRoutes } from '@/features/users';

app.route('/api/auth', authRoutes);
app.route('/api/users', userRoutes);
```

## Public interface

`src/features/<feature>/index.ts` is the Feature's general/server-facing public boundary. Other Features and application server composition may import only the intentional exports from this boundary.

Export the smallest interface that another capability needs:

```ts
// src/features/users/index.ts
export { userRoutes } from './server/routes';
export type { UserProfile } from './contract';
```

General or server-facing consumers use the boundary:

```ts
import { getCurrentUser } from '@/features/auth';
```

They must not import implementation files:

```ts
// Invalid: reaches through the auth Feature boundary.
import { findUserById } from '@/features/auth/server/repository';
```

### Browser public interface

When a Feature has browser surfaces, `src/features/<feature>/web/index.ts` is its explicit browser-safe public boundary. Application-wide Vue composition under `src/app/` may import browser pages, composables, and clients from this barrel:

```ts
import { LoginPage } from '@/features/auth/web';
```

Another Feature's browser code may use another Feature's `web/index.ts` only for a legitimate browser-safe dependency. Neither app composition nor another Feature may reach into `web/pages/*`, `web/components/*`, `web/client`, or `server/*`. The browser barrel must not export server-only runtime symbols.

The public indexes are intentional interfaces, not convenience barrels for every internal symbol. Arbitrary deep imports remain invalid.

### Consumer evidence

Nara derives cross-Feature consumer facts from statically declared imports and re-exports. Symbol-level evidence records the source Feature and file, target boundary, imported symbol, local/export alias, and whether the syntax is explicitly type-only or value-capable. Nara distinguishes explicitly type-only syntax from value-capable import/export syntax; it does not resolve declaration categories through the TypeScript type checker. A namespace import, side-effect import, `require`, dynamic import, or `export *` proves only a module dependency; Nara does not infer an exact symbol from those forms. These facts are evidence of declared architecture, not a prediction of runtime reachability or behavior.

### Boundary export provenance

Nara separately records how each symbol is exposed by the two canonical Feature boundaries:

- `src/features/<feature>/index.ts` is the `public` boundary.
- `src/features/<feature>/web/index.ts`, when present, is the `web` boundary.

`inspect`, `context`, and architecture snapshots expose `boundaryExports` as deterministic evidence. A record identifies the Feature, boundary file, exported name when syntax proves a symbol, export kind (`local`, `named-reexport`, `default`, or `export-all`), precision (`symbol` or `module`), optional source specifier and source symbol, and whether the export syntax is type-only. `publicExports` and `webPublicExports` remain the symbol-name projections of this evidence; an `export *` record never creates a pseudo-symbol.

Discovery is intentionally shallow. Nara parses declarations, local export lists, named re-exports, default exports, and export-all declarations in the canonical boundary file only. It does not recursively resolve another module's exports or use the TypeScript language service. A direct named re-export proves contract provenance only when its normalized relative source is this Feature's `contract` or `contract.ts`; unrelated re-exports, multi-hop chains, and export-all declarations do not prove a contract symbol.

## Contracts

`contract.ts` owns the data crossing the Feature boundary. Keep runtime validators and their TypeScript types together when external input is involved:

```ts
import { z } from 'zod';

export const profileInputSchema = z.object({
  name: z.string().trim().min(1),
});

export type ProfileInput = z.infer<typeof profileInputSchema>;
```

Server routes validate requests with the schema. Web code can reuse contract types and safe response shapes without importing server code. A contract is Feature-owned; it should not become an application-wide types directory.

## Server and web relationship

Server code belongs under `server/`. It may use databases, filesystem APIs, server-only dependencies, and private implementation details within its own Feature. The Feature exposes route sub-applications or safe general functions through `index.ts`.

Web code belongs under `web/` when the capability has a browser surface. It may import:

- the Feature's own `contract.ts`
- browser-safe dependencies
- the public browser boundary of another Feature, when the dependency is intentionally client-safe

Web code must not import another Feature's `server/` files, `src/shared/database`, server-only built-ins, or server-only packages. `nara doctor` checks these obvious leaks. A Feature without a browser surface should omit `web/` rather than add an empty layer.

The two public boundaries are:

```text
Feature
├── index.ts       # general/server public API
└── web/
    └── index.ts   # optional browser-safe public API
```

Application-wide browser composition uses `web/index.ts` for Feature-owned pages and browser utilities. It does not reach into the Feature's web implementation directories.

## Browser routing

Application-wide browser route composition belongs under `src/app/router.ts` and uses Vue Router. Routes may point to app-owned pages under `src/app/pages/` or Feature-owned pages under `src/features/<feature>/web/pages/`.

Features own their browser pages, but they do not own the global router. The app layer composes those pages through the owning Feature's browser-safe public barrel, `src/features/<feature>/web/index.ts`, rather than importing page files directly.

## Dependencies

Dependencies follow ownership and direction:

1. Code inside a Feature may import its own internals.
2. A general or server-facing Feature dependency uses the target Feature's root `index.ts`.
3. A browser-safe Feature dependency uses the target Feature's `web/index.ts` only when the dependency is legitimate and client-safe.
4. Application browser composition under `src/app/` uses Feature `web/index.ts` for browser surfaces.
5. Shared infrastructure may be imported where needed, but it owns no business capability.
6. Web code stays on the browser-safe side of the server boundary.

Dependency discovery retains every static cross-Feature module reference as deterministic evidence. It aggregates those references into the existing Feature graph, while preserving the richer symbol-level facts separately. This keeps graph compatibility for module-level imports without overstating which exported symbol a namespace or dynamic module consumer uses.

For example, the users Feature may depend on the auth Feature's browser-safe public interface for a client-side session surface. It does not import `auth/web/pages/*`, `auth/web/client`, `auth/server/repository.ts`, or `auth/server/service.ts`.

Feature dependencies should be acyclic. If `billing → users`, then `users → billing` is not a second harmless convenience; it is a cycle that obscures ownership and loading order. Move genuinely shared behavior to a lower-level capability or remove one edge.

## Shared code

`src/shared/` is intentionally small infrastructure for concepts owned by no business Feature:

```text
src/shared/
├── config/       Environment and application constants
├── database/     SQLite connection, migration, and seed engines
├── errors/       Application error types
└── logging/      Structured logger
```

Feature-owned schema changes live under `src/features/<feature>/server/migrations/`; reference seeds live under `server/seeds/`. The shared database layer discovers those directories but does not own application tables or business data.

Put a concept in a Feature when it has a natural business owner. Do not use `shared/` as a second global services, repositories, validators, or models layer. Shared code may support Features; it must not absorb their business decisions.

## Tests

Tests defend observable Feature behavior and live with the Feature under `tests/`. The CLI architecture engine also uses repository fixtures under `tests/fixtures/architecture/` to cover valid projects and intentional violations.

Prefer tests that prove:

- public route behavior and response contracts
- validation and authorization boundaries
- server/web separation
- public imports instead of internal coupling
- deterministic architecture diagnostics

Do not weaken a test or expose an internal module merely to make a dependency convenient.

## Anti-patterns

### Global technical ownership

```text
controllers/
services/
repositories/
validators/
models/
```

Do not distribute a capability across application-wide technical directories. Keep the related code under its Feature.

### Cross-Feature internal imports

```ts
// Invalid.
import { db } from '@/features/users/server/repository';
```

```ts
// Valid when the public interface exports this capability.
import { getUser } from '@/features/users';
```

### Server code in web code

```ts
// Invalid in src/features/reports/web/client.ts.
import { getDatabase } from '@/shared/database';
import fs from 'node:fs';
```

Expose browser-safe contract data instead. Keep persistence and filesystem work on the server.

### Business logic in shared

Do not move role policy, billing rules, or user workflows into `src/shared/` simply because multiple files need them. Assign ownership to the Feature and export a narrow public operation.

## Diagnostics

Run the deterministic architecture check after Feature changes:

```bash
nara doctor
nara doctor --json
```

A healthy project prints exactly:

```text
Architecture looks healthy.
```

The checks cover Feature shape, cross-Feature public boundaries, application-to-Feature browser boundaries, dependency cycles, and server/client leaks. No AI provider is required.
