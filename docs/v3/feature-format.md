# Installable Feature Format

Nara v3 installs open source code into `src/features/<name>/`. The installed files become ordinary project source: users can inspect, edit, test, and remove them without an opaque runtime.

## Package shape

An official package is a directory named for the feature. Its contents mirror the destination feature directory:

```text
<feature-package>/
├── index.ts
├── contract.ts             # when the feature has a typed boundary
├── server/                  # when the feature owns server behavior
│   ├── migrations/          # optional plain SQL schema changes
│   └── seeds/               # optional idempotent reference seeds
├── web/                     # when the feature owns client behavior
└── tests/                   # when the feature ships behavior tests
```

Empty directories and placeholder files are not part of the format. A package contains only code that the capability needs. `index.ts` is the public boundary when the package exposes cross-feature behavior. A database-backed package may include `server/migrations/` and `server/seeds/`; the shared lifecycle discovers them by convention without a registry.

## Installation

`nara add <name>` resolves an official package, checks the destination before writing, and installs its files to `src/features/<name>/` plus explicit application-owned bindings (`src/app/bindings/`) with composition calls in the canonical roots and transactional `package.json` prerequisite composition. `nara new` uses the same source-copy transaction for the default `health` Feature. Neither command merges into an existing same-name directory. A collision is an error and leaves the existing source unchanged.

The installer does not replace npm, load code dynamically, keep installed behavior in the Nara package, edit `package-lock.json`, run `npm install`, or auto-install provider Features. The resulting files belong to the application and use its existing TypeScript dependencies. Package dependency changes remain ordinary `package.json` changes the application installs itself.

The architecture engine discovers the installed result from `src/features/*`; no architecture manifest is required. The package directory is a distribution source only and is not itself an application feature.

## Composable Open Code

Feature-owned implementation and application-owned integration are separate
forms of ownership:

```text
Feature source        → evolvable upstream relationship
Application binding   → local application decision
```

> Official Features do not need zero application-level changes. They need
> zero hidden application-level changes.

An official package may ship optional distribution-only assembly templates:

```text
<feature-package>/
├── index.ts
├── ...
└── .nara/
    └── assembly/
        ├── server.ts
        └── web.ts
```

A server template is ordinary TypeScript that mounts the Feature's public
boundary export on the Hono instance it receives:

```ts
import type { Hono } from 'hono';
import { healthRoutes } from '../../features/health';

export default function composeHealthServer(app: Hono): void {
  app.route('/health', healthRoutes);
}
```

A web template is ordinary TypeScript that default-exports Vue Router
records referencing the Feature's web boundary:

```ts
import type { RouteRecordRaw } from 'vue-router';
import { GalleryPage } from '../../features/gallery/web';

export default [
  {
    path: '/gallery',
    name: 'gallery',
    component: GalleryPage,
  },
] satisfies RouteRecordRaw[];
```

Template import specifiers are written destination-relative: the installed
binding lives at `src/app/bindings/<feature>.server.ts` (or `.web.ts`), so
`../../features/<feature>` reaches the Feature boundary from there.
Installation copies the template bytes verbatim into the application-owned
binding and explicitly consumes the binding from the canonical root
(`src/app/server.ts` invokes the server binding with the proven Hono
instance; `src/app/router.ts` spreads the web binding into the proven
`createRouter({ routes })` array). Installation may therefore create
explicit application-owned binding source and explicit composition calls,
but Nara never hides those relationships behind a runtime registry.

Assembly templates are an installation recipe, not architecture truth.
Hidden-file exclusion keeps them out of Feature source and lineage `BASE`;
the architecture engine never treats `official-features/*/.nara` as
application architecture. After installation, Nara understands the
application solely from `src/features` and `src/app`, and a binding file
that is not explicitly consumed by its canonical root is reported as
inactive — never as an integration.

`nara add` prepares Feature source, lineage, binding files, and canonical
app-root edits as one fail-closed transaction: collisions fail before
mutation, the candidate must prove its assembly facts through the
architecture engine with no newly introduced diagnostic, and only then is
anything applied. Existing source is never silently replaced, and later
`nara evolve` advances Feature-owned source while leaving application
bindings byte-identical.

## Local lineage

After a successful `nara new` or `nara add`, the CLI stores the exact
official source bytes under
`.nara/lineage/official-features/<name>/base/` and writes a minimal
`lineage.json` record containing the source kind and deterministic SHA-256
digest. This is reconciliation state only; the architecture engine continues
to discover application Features from `src/features/*`.

`nara evolve <name>` compares that `BASE` with the installed `LOCAL` source
and the current bundled `INCOMING` package. It applies only deterministic,
conflict-free three-way results, validates an isolated candidate with the
architecture engine, and advances the lineage after a successful replacement.

## Composition dependencies

Packages carry no architecture dependency metadata. The application
dependency graph stays inferred from TypeScript imports (`nara doctor`,
`nara impact`), so there is exactly one source of architectural truth and
no npm-within-Nara. A package may still ship distribution-only
requirements (`.nara/requirements.json`: provider and npm prerequisites)
that `nara add` validates and composes explicitly; that metadata is
installer help, never architecture truth.

When one capability requires another (for example, the `users` package
requiring an `auth`-compatible provider), the rule is: declare the typed
host requirement, validate the provider surface against application
source, and fail with a precise message when it is absent — or bundle
the tightly coupled capabilities as one package. Automatic dependency
installation and manifest resolution are non-goals.

This is why the catalog stays small: a capability joins
`official-features/` only when `nara add` produces explicit,
deterministic, application-owned composition with zero hidden
application-level changes: every file outside the new Feature directory
is visible, ownership is clear, existing source is never silently
replaced, and the architecture engine verifies the resulting integration
before anything is applied. Auth remains a reference implementation
rather than a package: it is one valid Users provider, not a capability
that itself needs packaging.
