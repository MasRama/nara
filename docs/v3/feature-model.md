# Nara v3 Feature Architecture

A Feature is one business capability and the primary unit of application organization. Its public contract, runtime behavior, optional web surface, and tests stay together.

This arrangement is deliberate: a person or coding agent can find the complete change surface from one directory, while Nara can validate the boundaries from ordinary TypeScript files. Technical layers still exist inside a Feature; they do not own the application globally.

## Canonical structure

Features live under `src/features/<feature>/`. Names are lowercase kebab-case business names such as `auth`, `users`, and `billing`.

```text
src/features/billing/
├── contract.ts       # feature-owned types and runtime input schemas
├── index.ts          # public boundary
├── server/           # routes, services, repositories, adapters
├── web/              # optional browser code and typed API client
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
│   ├── repository.ts
│   ├── routes.ts
│   └── service.ts
├── tests/
└── web/
    ├── client.ts
    └── index.ts

src/features/users/
├── contract.ts
├── index.ts
├── server/
│   ├── assets-routes.ts
│   ├── assets.ts
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

`src/features/<feature>/index.ts` is the Feature's public boundary. Other Features and application composition may import only from that boundary.

Export the smallest interface that another capability needs:

```ts
// src/features/users/index.ts
export { userRoutes } from './server/routes';
export type { UserProfile } from './contract';
```

Consumers use the boundary:

```ts
import { getCurrentUser } from '@/features/auth';
```

They must not import implementation files:

```ts
// Invalid: reaches through the auth Feature boundary.
import { findUserById } from '@/features/auth/server/repository';
```

Moving or splitting files under `server/` or `web/` is an internal change when the public exports remain stable. The public index is not a convenience barrel for every internal symbol; it is the capability's intentional API.

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

Server code belongs under `server/`. It may use databases, filesystem APIs, server-only dependencies, and private implementation details within its own Feature. The Feature exposes route sub-applications or safe functions through `index.ts`.

Web code belongs under `web/` when the capability has a browser surface. It may import:

- the Feature's own `contract.ts`
- browser-safe dependencies
- public interfaces of other Features, when the dependency is intentionally client-safe

Web code must not import another Feature's `server/` files, `src/shared/database`, server-only built-ins, or server-only packages. `nara doctor` checks these obvious leaks. A Feature without a browser surface should omit `web/` rather than add an empty layer.

The relationship is therefore:

```text
Feature contract ───────┐
                        ├── server routes/services/repositories
                        └── optional web client/pages/components

Feature public index ─── application composition and other Features
```

## Browser routing

Application-wide browser route composition belongs under `src/app/router.ts` and uses Vue Router. Routes may point to app-owned pages under `src/app/pages/` or Feature-owned pages under `src/features/<feature>/web/pages/`.

Features own their browser pages, but they do not own the global router. The app layer composes those pages into the application's client-side routes.

## Dependencies

Dependencies follow ownership and direction:

1. Code inside a Feature may import its own internals.
2. A Feature importing another Feature uses the target public `index.ts`.
3. Application composition may import Feature public exports to mount routes.
4. Shared infrastructure may be imported where needed, but it owns no business capability.
5. Web code stays on the browser-safe side of the server boundary.

For example, the users Feature depends on the auth public interface for the current session and role checks. It does not import `auth/server/repository.ts` or `auth/server/service.ts`.

Feature dependencies should be acyclic. If `billing → users`, then `users → billing` is not a second harmless convenience; it is a cycle that obscures ownership and loading order. Move genuinely shared behavior to a lower-level capability or remove one edge.

## Shared code

`src/shared/` is intentionally small infrastructure for concepts owned by no business Feature:

```text
src/shared/
├── config/       Environment and application constants
├── database/     SQLite connection and schema bootstrap
├── errors/       Application error types
└── logging/      Structured logger
```

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

An invalid project exits non-zero and reports the problem, source file, Feature relationship, reason, and recommended fix. The checks cover Feature shape, cross-Feature internal imports, dependency cycles, and server/client leaks. No AI provider is required.
