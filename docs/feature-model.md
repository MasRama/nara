# Nara Feature Architecture

A Feature is one business capability and the primary unit of application organization. Its public contract, runtime behavior, optional web surface, and tests stay together.

This arrangement is deliberate: a person or coding agent can find the complete change surface from one directory, while Nara can validate the boundaries from ordinary TypeScript files. Technical layers still exist inside a Feature; they do not own the application globally.

## Canonical structure

Features live under `src/features/<feature>/`. Names are lowercase kebab-case business names such as `auth`, `users`, and `billing`.

```text
src/features/billing/
├── contract.ts       # feature-owned types, input schemas, and response schemas
├── index.ts          # general/server-facing public boundary
├── server/           # routes, services, repositories, adapters
│   ├── config.ts     # optional environment variables and settings this feature owns
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
export { createUserRoutes } from './server/routes';
export type { UserProfile } from './contract';
export type { UsersServerHost } from './server/host';
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

Responses are declared the same way, as strict schemas returned from one function so browser bundles keep only the inferred types:

```ts
export function profileResponseSchemas() {
  const profile = z.strictObject({ id: z.string(), name: z.string() });
  return { profile, saved: z.strictObject({ success: z.literal(true), message: z.string(), data: profile }) };
}

export type ProfileSaved = z.infer<ReturnType<typeof profileResponseSchemas>['saved']>;
```

Routes type each response with `satisfies ProfileSaved`, and copy fields explicitly instead of spreading rows or provider objects. A contract test in the Feature's `tests/` runs every `web/` client method against the real app (`installBrowser(app)` from `src/shared/security/tests/browser.ts`) and parses each answer, refusals included, with these schemas, so a renamed path, a renamed field, or an undeclared field fails.

Refusal codes are part of the contract too. Each Feature lists the codes its routes answer with (`AUTH_REFUSAL_CODES`, `USERS_REFUSAL_CODES`) and its error schema accepts those plus `API_REFUSAL_CODES` from `src/shared/security/codes.ts`, the codes any Feature route under `/api` can get from the shared guards, input validation, and the pipeline ahead of it. Routes send codes as literals (`code: 'NOT_FOUND' as const`) and each `web/` client method returns its contract response type, so the typed client rejects a code the contract does not declare and a page that branches on a misspelt code fails to compile.

Routes validate input with middleware that declares the schema on the route:

```ts
.patch('/me', guard.signedIn, jsonInput(profileInputSchema), (context) => {
  const input = context.req.valid('json'); // ProfileInput, already parsed
  // ...
})
```

`jsonInput(schema)` and `queryInput(schema)` come from `src/shared/security`, which installable Features may rely on as part of the guaranteed substrate. A missing or malformed JSON body is validated as `{}`, so every refusal is the same `422 VALIDATION_ERROR`; empty query values count as absent. Validation runs before the handler, so an invalid body is refused with 422 before a state check could answer 404 or 409. A check that decides whether the caller may act at all belongs in middleware ahead of `jsonInput`, so a caller without access never sees validation details (Users' `PUT /api/users/:id` guard admits the account itself or a holder of `users.edit` this way, reading the target from the request).

Every API route declares who may call it. `guard.signedIn` and `guard.allow(rule)` from `createGuard` record `signed-in` and `restricted` on the middleware they return (`allow` also records the rule itself), `publicRoute` marks a route anyone may call, and a handler that answers 401 itself (the live-update stream) declares its access with `declareRouteAccess`. At startup the application reads Hono's route table, sub-applications included, and refuses to start while an `/api` route declares none, naming it: a route that forgot its guard would otherwise answer anyone. The application's authorization matrix test (`src/app/authorization-matrix.test.ts`) is generated from the same table, so a Feature's new route is tested for anonymous callers, members, holders of the permission its rule names, administrators, and temporary passwords without editing it.

A rule is an `AccessRule` from `src/shared/security/access.ts`: `{ permission: '<resource>.<action>' }` or `ADMINISTRATOR`, and administrators meet every rule. It is data, so one value serves every consumer: the route's guard enforces it (`createGuard(resolve, satisfies)` is told how to check one), the page hides what the route would refuse, the browser route's `meta.requiresAccess` keeps the page out of reach and out of the navigation, and the matrix tests it. A Feature states which rule each capability needs in its contract, in its own vocabulary: `usersAccess(resource)` gives `manage(action)`, `resetPasswords`, and `assignRoles`; `activityAccess(resource)` gives `view`; Auth's `rolesAccess(action)` covers its own role routes. The binding builds them under the resource it declared the permissions for and hands the same value to the server host and the browser host, with an `allows` check from Auth (`isAllowed(userId, rule)` on the server, `authSession.allows(rule)` in the browser). Nothing restates the mapping from capability to permission.

Web clients call the routes through Hono's `hc`, typed from the Feature's own route factory with `import type`, so no server code reaches the browser bundle:

```ts
const api = hc<ReturnType<typeof createUserRoutes>>('/api/users', { fetch: apiFetch });
updateProfile: async (input) => (await api.me.$patch({ json: input })).json(),
```

`apiFetch` adds the session cookie and, on writes, the CSRF token. Each client method keeps its contract return type (`Promise<UserProfileResponse>`), so `npm run lint` fails when a path, a request body, or a response field drifts between route and client. Guards, CSRF, and rate limits answer from middleware the inferred types cannot see; the contract unions include those refusals. Each Feature's `tests/client-types.ts` pins this with `@ts-expect-error` on a wrong route, body, and response field.

## Server and web relationship

Server code belongs under `server/`. It may use databases, filesystem APIs, server-only dependencies, and private implementation details within its own Feature. The Feature exposes route sub-applications or safe general functions through `index.ts`. A substantial Feature whose behavior needs application-owned capabilities exposes factories built from explicit host requirements (for example, `createUserRoutes(host)`) instead of singletons wired to another Feature; the application binding owns the final mount paths.

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

The authenticated shell's navigation comes from the same route records. A route opts in with `meta: { nav: { label } }`; the shell lists those top-level routes in route order and hides one whose `meta.requiresAccess` rule the session does not meet, using the check the router guard applies (`src/app/navigation.ts`). A binding's routes therefore bring their own links, and the shell names no Feature.

## Dependencies

Dependencies follow ownership and direction:

1. Code inside a Feature may import its own internals.
2. A general or server-facing Feature dependency uses the target Feature's root `index.ts`.
3. A browser-safe Feature dependency uses the target Feature's `web/index.ts` only when the dependency is legitimate and client-safe.
4. Application browser composition under `src/app/` uses Feature `web/index.ts` for browser surfaces.
5. Shared infrastructure may be imported where needed, but it owns no business capability.
6. Web code stays on the browser-safe side of the server boundary.

Dependency discovery retains every static cross-Feature module reference as deterministic evidence. It aggregates those references into the existing Feature graph, while preserving the richer symbol-level facts separately. This keeps graph compatibility for module-level imports without overstating which exported symbol a namespace or dynamic module consumer uses.

For example, the users Feature does not import the auth Feature at all — not even its public boundaries. It does not import `auth/web/pages/*`, `auth/web/client`, `auth/server/repository.ts`, or `auth/server/service.ts`, and it does not import the auth public indexes either.

Feature dependencies should be acyclic. If `billing → users`, then `users → billing` is not a second harmless convenience; it is a cycle that obscures ownership and loading order. Move genuinely shared behavior to a lower-level capability or remove one edge.

## Feature dependencies vs host requirements

Feature dependencies are code dependencies inside Feature-owned source: a static import from one Feature to another Feature's public boundary. They describe what a Feature is built from.

Host requirements are application composition seams: typed contracts a Feature declares for behavior it needs but does not own, supplied by application-owned bindings as plain TypeScript values. They describe what a Feature must be given to run.

A Feature needing an authenticated actor does not necessarily mean:

```text
users → auth
```

It can mean:

```text
users → UsersServerHost          (Feature-owned requirement contract)

application binding:
  Auth → satisfies UsersServerHost   (application-owned adaptation)
```

- Requirements are ordinary TypeScript interfaces and factory parameters (for example, `createUserRoutes(host: UsersServerHost)`). No container, no service locator, no decorators, no global registry, no Nara-specific runtime.
- Requirements represent the Feature's actual needs in its own vocabulary, not the provider's implementation. The application binding adapts between the two (Users asks `allows(actorId, host.access.manage('edit'))` and `findAccountById`; the Auth-backed binding answers with `isAllowed` and its account directory). The browser host mirrors it: `UsersPage` asks `allows(host.access.manage('create'))`, `allows(host.access.assignRoles)` and `allows(host.access.resetPasswords)` against the same rules, and spells no permission slug.
- Requirements stay demand-driven and narrow: a small number of cohesive interfaces when responsibilities genuinely separate (for Users, `UsersIdentityHost` for account-directory behavior and `UsersAuthorizationHost` for roles and permissions), never a speculative universal service bag or a generic `execute()`/`services` catch-all.
- The provider relationship belongs to application composition (`src/app/bindings/`), never to Feature-owned source. `inspect`/`context` therefore show no Feature dependency while the binding reading order shows the composition.
- A requirement says everything the Feature relies on; nothing about the provider leaks through untyped. Outcomes are values, not provider errors: Users' `createAccount` and `updateAccount` answer `duplicate-email` rather than letting a database constraint error reach its routes, and Users asks whether an account is an administrator with `allows(id, ADMINISTRATOR)`, `administrators()`, and a role's `administrator` flag instead of knowing the provider calls that role `admin`. The binding translates (Auth throws on a taken email; the binding catches it with Auth's `isDuplicateEmailError`).
- The behaviour behind a requirement is tested, not just its types. A Feature ships a conformance suite with its host contract (`describeUsersHost(provider, setup)` in Users' `tests/host-conformance.ts`): the application runs it against its own binding (`src/features/users/tests/binding-conformance.test.ts`, Auth behind it), and the Feature's tests run it against an unrelated in-memory provider, so the suite cannot describe one provider's habits. The setup supplies only what the Feature never does itself, signing in and granting a permission. A provider that passes runs the Feature.
- Evolution never touches application bindings; an incompatible requirement change surfaces through TypeScript, tests, and architecture evidence — there is no automatic binding migration.
- Only the guaranteed application substrate may be imported from `src/shared/` (`config`, `database`, `realtime`, `security`, `storage`; see below). Reference-only modules (logging, app tuning) must be feature-owned or host-provided instead. Host requirements are for application/business integration seams, not for every utility.
- Permissions belong to the Feature that gates them. A Feature exports its actions as `PermissionDeclaration`s (`USERS_PERMISSIONS`, `ACTIVITY_PERMISSIONS`); its binding hands them to Auth with `declarePermissions(resource, actions)` while the app is composed, and startup writes the `<resource>.<action>` rows right after migrations, matched by slug so ids and role grants survive. The admin role holds every declared permission. A stored slug no Feature declares is kept and reported in a startup warning, never deleted.
- Table upkeep belongs to the Feature that owns the table. A Feature exports `MaintenanceTask`s (`AUTH_MAINTENANCE`, `ACTIVITY_MAINTENANCE`); its composition declares them with `declareMaintenance(feature, tasks)`, and the application runtime runs them once after migrations and then on each task's interval, logging failures without stopping the server. In-process timers only: no queue, persistence, or retries.
- Reported activity belongs to the Feature it happened in. A Feature exports the actions it reports as `ActivityDeclaration`s from `src/shared/security` (`AUTH_ACTIVITY`, `ROLES_ACTIVITY`, `USERS_ACTIVITY`): the action, the English label a feed shows, and its kind (`create`, `update`, `delete`, `access`). The application's activity reporter turns them into a sink with `activity.declare(resource, actions)`, called where the reporting Feature is composed, and that sink's type is `ReportedActivity<resource, actions>`, so reporting an undeclared `<resource>.<action>` fails to compile. Activity serves the declarations with its feed (`data.actions`) and labels and filters from them; it lists no other Feature's actions, and a stored action nobody declares still shows with a plain label.
- Route policy belongs to the Feature that owns the route. A Feature exports `RoutePolicy` lists relative to its router (`AUTH_ROUTE_POLICIES`, `USERS_ASSET_ROUTE_POLICIES`): `sensitive` routes share the strict per-client limit, and `bodyMaxBytes` gives one method and path a larger request budget. Whatever mounts the router declares them next to `app.route` with `declareRoutePolicies(app, mountPath, policies)`. The application's outer middleware reads those declarations per request, so cheap rejection still runs before any body is read, and neither `server.ts` nor `src/shared/security` lists a Feature's sensitive paths or budgets.
- Persistence ownership is single-writer per table: a Feature that needs another Feature's rows reaches them exclusively through a typed host requirement, never through direct SQL. The `users` table is Auth-owned; Users owns its workflow and its `assets` table with a provider-neutral owner reference.
- Tests keep the same ownership. Tests outside Auth make accounts with the application's personas (`src/app/tests/personas.ts`: `signUp`, `grantAdmin`, `grantPermissions`, `grantRole`, `revokeRoleFromEveryone`, `requirePasswordChange`), which register through Auth's routes and grant through its public boundary, refusing a permission no Feature declares. `src/app/tests/personas.test.ts` fails when a test outside Auth writes a table Auth's migrations create; the few that must, to build rows no route can, are listed there with the reason.

## Configuration

A Feature owns the settings its behavior depends on. Fixed settings and the
environment variables it reads live in its private `server/config.ts`:

```ts
import { z } from 'zod';
import { readFeatureEnv } from '../../../shared/config';

const environment = readFeatureEnv('billing', {
  BILLING_GRACE_DAYS: z.coerce.number().int().min(0).default(7),
});

export const BILLING = {
  GRACE_DAYS: environment.BILLING_GRACE_DAYS,
  INVOICE_PREFIX: 'INV',
} as const;
```

`readFeatureEnv` validates when the module loads, so a bad value stops the
application at boot with the owning Feature named in the error. Each variable
has exactly one owner: reading a variable that core configuration or another
Feature already reads is an error. `src/shared/config/` keeps only
business-neutral settings (port, logging, database file, proxy trust, request
limits). When the application needs a Feature's setting, the Feature exports
it, or the operation that applies it, from `index.ts`; the application never
reads another owner's variables.

The environment templates (`.env.example`, `.env.production.example`) are
checked against the variables the running application actually reads, in both
directions, so an undocumented or stale setting fails the test suite.

## Interface text

Pages are written in English, with their text in the template where it is
read. A page shows an API refusal by its `message` and branches on `code`
only to change what it does (start over, mark a field), never on message
text. Contract validation messages are shown as Zod reports them.

## Live updates

An open tab hears about changes over one Server-Sent Events stream,
`GET /api/events`, which the application mounts with Auth deciding who is
listening. Events are signals, not data: a topic such as `activity.recorded`
tells the page to refetch through its Feature's own client, so every
permission check stays in the route that already makes it.

- A Feature names its topics in `contract.ts` (`<NAME>_EVENT`) and declares each one with its audience through `liveTopic(name, { rule, affected })` from `src/shared/realtime`, when its routes are created: listeners meeting `rule` (the same `AccessRule` a route carries) receive every publication, and with `affected: true` so do the accounts a publication names. `publish(topic, affectedIds?)` takes only a declared topic, so a publisher picks who is affected but never widens the audience. Auth's session and account topics reach the accounts they name, its role topics reach `roles.view` holders, Users' reach whoever may view the directory plus the changed accounts, and Activity's reach whoever may read the feed.
- The application's event stream asks Auth whether a listener meets a topic's rule, at every publication, with the check its guards make; a revoked grant stops events at once. A name declared again with the same audience returns the same topic, and with another audience throws.
- The realtime matrix test (`src/app/realtime-matrix.test.ts`) is generated from the declared topics, as the authorization matrix is from the routes: it publishes each topic to an account without grants, a holder of its permission, an administrator, and an account the publication names, and fails when anyone outside the audience receives it, or anyone inside it does not. It also fails when a contract names a topic the composed application never declared.
- Ending a session calls `revalidate`; a stream whose session no longer resolves gets `stream.ended` and closes. Each heartbeat (25 s) re-resolves the session too, so an expired session is noticed without a mutation.
- In the browser, `onServerEvent(topic, handler)` from `src/shared/realtime/browser` subscribes and returns the unsubscribe function. After a dropped connection comes back, every handler runs again with `resumed: true`, because events sent meanwhile are lost.
- `src/app/live-updates.ts` opens the stream while someone is signed in, sends the tab to the login page with a notice when its session ends elsewhere, and re-reads the account when `auth.account-changed` arrives, leaving a page whose permission is gone.

The hub lives in one process. Running several server processes behind a load
balancer would need a shared broadcast channel, which Nara does not ship.

## Concurrent edits

Two people can open the same role or account at once; neither silently
overwrites the other.

- Each editable row has a `revision` column that every update raises. An update input carries the `revision` it was based on, and the repository writes with `WHERE id = ? AND revision = ?`. When nothing matches, the route answers `409 STALE_REVISION` with the record as it is now in `current`. Writes that are not form edits, such as an avatar upload, apply without a revision but still raise it.
- In the browser, `mergeEdit(base, mine, theirs)` from `src/shared/realtime/browser` merges three versions of a form: a field only the other side changed follows them, a field only you changed stays yours, and a field you both changed differently is a conflict that keeps your value until you choose. Array fields such as permissions or roles merge as sets and never conflict. Pages run it when a change event announces a newer revision and when a save is refused as stale, and keep Save disabled while a conflict is open.
- Presence is advisory. `createPresence({ onChange })` from `src/shared/realtime` keeps who is editing what in the process; entries expire after 30 s unless renewed. Pages call `keepEditing(id, client)`, which renews every `PRESENCE_RENEW_MS` (10 s) through `PUT /api/<resource>/:id/editing` and leaves through `DELETE` on close or `pagehide`. `GET /api/<resource>/editing` lists editors for whoever may view the resource, and `onChange` publishes the Feature's editing topic (`auth.roles-editing`, `users.editing`).
- Users, though installable, uses all of this directly, since `src/shared/realtime` is part of the guaranteed substrate. Its topics carry the rule its binding chose, `access.manage('view')`, and `users.changed` also reaches the changed accounts.

## Shared code

`src/shared/` is intentionally small infrastructure for concepts owned by no business Feature:

```text
src/shared/
├── config/       Business-neutral environment and constants, plus readFeatureEnv
├── database/     SQLite connection, migration, and seed engines
└── logging/      Structured logger
```

Feature-owned schema changes live under `src/features/<feature>/server/migrations/`; reference seeds live under `server/seeds/`. The shared database layer discovers those directories but does not own application tables or business data.

Put a concept in a Feature when it has a natural business owner. Do not use `shared/` as a second global services, repositories, validators, or models layer. Shared code may support Features; it must not absorb their business decisions.

### Guaranteed application substrate

The canonical Nara application carries a small guaranteed substrate, so
installable Features can rely on it:

- the Hono/Vue/Vue Router/TypeScript stack and canonical `src/app` roots,
- the Feature structure itself (`src/features/<feature>/`),
- `src/shared/database/` (SQLite persistence engine),
- `src/shared/config/` (environment and constants it reads),
- `src/shared/realtime/` (Server-Sent Events `liveTopic` and `publish`, editing presence, and the browser's `onServerEvent`, `mergeEdit`, and `keepEditing`),
- `src/shared/security/` (route guards, `jsonInput`/`queryInput`, and the generic person and email input schemas),
- `src/shared/storage/` (provider-neutral `AssetStorage` contract plus the local filesystem adapter).

Only these `src/shared/` modules are guaranteed. `AssetStorage` keys are
provider-neutral logical object identifiers; Features own asset metadata and
delivery URLs while the application binding chooses the storage provider.
Everything else under
`src/shared/` (logging, error taxonomy, app tuning constants) is
reference-only: official Features must own such behavior themselves or
receive it through a typed host requirement. `nara add` never copies
`src/shared/` during installation; it reads which modules the package
imports and refuses one outside this list, or one the application no longer
provides, before writing anything. `nara evolve` applies the same check to
incoming source.

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

## Evolvable official source

`nara add <feature>` installs official Features as ordinary source and records
their local lineage snapshot:

```text
.nara/lineage/official-features/<feature>/
├── base/          # exact official bytes
└── lineage.json   # schema, source kind, and SHA-256 digest
```

`nara evolve <feature>` uses that snapshot as `BASE`, the installed Feature
as `LOCAL`, and the current official package bundled with the local CLI as
`INCOMING`. It never uses Git history as the Feature base and never reads
lineage as architecture metadata.

The reconciliation plan is deterministic. Upstream-only changes update or
remove files; local-only files survive; additions and deletions are explicit;
non-overlapping text edits merge through `git merge-file`; binary files and
incompatible deletion states conflict. `--dry-run --json` is read-only.
Conflicts return non-zero without writing conflict markers or partial source.

Before applying a conflict-free plan, Nara validates an isolated candidate
with the existing source-derived architecture snapshot and diff model. The
affected set is structural dependency impact. Newly introduced diagnostics
block the apply; existing diagnostics remain baseline debt. On success,
lineage advances to pure `INCOMING` bytes, while merged `LOCAL` customization
stays only in `src/features/<feature>`.

Lineage is fail-closed: a missing snapshot can be bootstrapped only when local
source is identical to current official source. Divergent legacy source and
Features without an official package are not evolved.

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
