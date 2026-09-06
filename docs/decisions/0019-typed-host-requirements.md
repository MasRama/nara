# ADR 0019: Typed Host Requirements for Feature Assemblies

Date: 2026-09-06
Status: Accepted

## Context

Feature Assemblies (ADR 0018) made substantial capabilities installable by
splitting ownership: Feature-owned source under `src/features/<feature>/`
and application-owned bindings under `src/app/bindings/`, with activation
proven statically from the canonical roots. The first assembly (Health)
needed no host capabilities — route composition alone was sufficient.

Users is the first substantial proof and it does need them. User management
requires identity resolution, password hashing, permission checks, and role
assignment, none of which Users owns. Before this decision, Users imported
the Auth Feature directly (server routes, asset routes, web client, and both
pages), so the architecture graph claimed `users → auth` and no alternative
identity provider could ever satisfy the capability. Route composition alone
cannot express "this Feature needs these behaviors supplied by the
application" — mounting a route object says where code runs, not what it is
allowed to assume about its host.

A second gap surfaced while proving the assembly: generated projects could
not typecheck any Feature with browser TypeScript files, because the server
`tsconfig.json` (which necessarily includes `src/app/router.ts`, and through
it the web bindings) had no DOM library. The reference repository only
passed by accident, through `/// <reference lib="dom" />` lines in
unrelated test files.

## Decision

Introduce **typed host requirements** as ordinary TypeScript contracts:

```text
Feature implementation
        ↓ declares
typed host requirements (interfaces + factory parameters)
        ↓ supplied by
application-owned binding (plain values, explicit construction)
        ↓ using
whatever provider the application chooses (Auth by default)
```

Concretely for Users:

- `UsersServerHost` (`src/features/users/server/host.ts`): session-cookie
  name, actor resolution, password hashing, `canManageUsers` /
  `canAssignRoles`, and role read/assign operations in Users vocabulary.
- `createUserRoutes(host)` / `createAssetRoutes(host)` factories replace the
  `userRoutes` / `assetRoutes` singletons. One host value builds both route
  groups.
- `UsersWebHost` (`src/features/users/web/host.ts`): session reads, permission
  checks, role listing, password change, and CSRF — received by pages as Vue
  Router `props` from the application web binding.
- The reference application binds both hosts to Auth in
  `src/app/bindings/users.server.ts` / `users.web.ts`, including deliberate
  vocabulary adaptation (Users asks `canManageUsers(actorId, action)`; the
  binding answers with Auth's `isAdmin` / `hasPermission`. It translates
  Auth's snake_case password errors to the pages' camelCase fields).
- After the refactor the Users Feature has zero Auth imports and the graph
  claims no `users → auth` edge; the bindings import both Features, and
  `inspect`/`context` show the composition through ordinary source evidence
  and binding reading order.
- The server assembly discovery follows one conservative hop (a `.route()`
  argument that is a local value produced by calling an imported
  public-boundary factory), so factory mounts stay provable without
  weakening direct-composition strictness.
- `nara add users` validates Auth as a provider prerequisite from the
  assembly templates' own static imports and fails closed without mutation
  when the provider (or a required symbol) is missing. There is no Feature
  dependency resolver.
- No new architecture fact type for "host binding supplied": the
  requirement side is visible as ordinary boundary exports and the supply
  side as ordinary binding imports. Accuracy over completeness — no
  synthetic claim is reported.
- The generated-project server `tsconfig.json` gains `"dom",
  "dom.iterable"` libraries with an explanatory comment, because the server
  program legitimately includes browser files through the router and web
  bindings.

Persistence ownership is deliberately directional, not circular: Users owns
the `users` and `assets` tables (profile/managed CRUD, avatar assets). Auth
owns `sessions`, `roles`, `permissions`, `role_permissions`, and
`user_roles`, and keeps its existing narrow identity reads/writes against
the `users` table for login/registration/session concerns. There is exactly
one host direction — Users requirements supplied by the application, never
mutual runtime factories. The host interface exposes behavior only, never
session internals or repository objects.

## Consequences

Positive:

- Users is swappable by construction: the reference suite binds it to a
  small in-memory provider proving authorization, roles, passwords, and
  assets work without Auth.
- The default experience is unchanged: the reference app behaves
  identically through the Auth-backed binding, and all pre-existing Users
  tests pass unmodified in intent.
- Installation and evolution keep their guarantees: `nara add users` is one
  validated transaction (source, lineage, both bindings, both canonical
  roots), and `nara evolve users` advances Feature source while customized
  bindings survive byte-identical.
- Generated projects can now host any Feature with browser sources, not
  just Users.

Negative:

- Two vocabularies must be maintained where Users and Auth overlap (role
  shapes, password error keys); the binding owns the translation and must
  be updated if either side changes incompatibly. That failure surfaces via
  TypeScript and tests, not silently.
- The `users` table is shared storage with a documented row-level split
  rather than a single owner; future identity changes must respect both
  Features' statements.
- Static analysis stays conservative: dynamic factory patterns and
  non-canonical composition remain invisible by design.

## Alternatives considered

- **Runtime DI container / service locator (`register` / `resolve` /
  `inject`, decorators, global registry)** — rejected. It hides wiring
  behind a Nara abstraction, makes the application unintelligible without
  the CLI, and contradicts the zero-hidden-change principle. Plain values
  passed explicitly are sufficient.
- **Keeping direct `users → auth` imports and calling the seam done** —
  rejected. It preserves the false modularity (a hard Auth dependency for
  behavior any provider could supply) and blocks the alternative-provider
  proof entirely.
- **One kitchen-sink `UsersHost` plus a universal frontend container** —
  rejected in favor of two narrow, demand-driven interfaces
  (`UsersServerHost`, `UsersWebHost`) shaped by actual call sites, with web
  delivery through ordinary router props instead of a new mechanism.
- **Automatic binding migration during `nara evolve`** — rejected as
  speculative (consistent with ADR 0018). Bindings are local customization;
  incompatible requirement changes fail visibly through the existing gates.
- **A new `host-bindings` architecture fact with provider proof** —
  deferred. The requirement/supply relationship is already understandable
  through boundary exports, binding imports, routes, and reading order;
  a dedicated claim risked false positives for little added understanding.
- **Excluding browser files from the generated server tsconfig** —
  impossible without also excluding the router that imports them. The DOM
  library addition reflects the real program shape.

## Follow-up (ADR 0020)

The initial Users proof left two contradictions that ADR 0020 resolves
without rewriting the decision above: account identity storage stayed
under Users migrations while Auth wrote its rows directly, and the
official package carried hidden prerequisites (reference-only shared
imports, undeclared npm packages) that only surfaced as downstream
type or module failures. ADR 0020 moves identity ownership to Auth,
extends the host with account-directory behavior, drops the
provider-coupled foreign key, and introduces explicit distribution
requirements with transactional `package.json` composition. The
`UsersServerHost` / `UsersWebHost` seam shape from this ADR is unchanged
apart from the demand-driven identity/authorization split.
