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

`nara add <name>` resolves an official package, checks the destination before writing, and copies its files to `src/features/<name>/`. It never merges into an existing same-name directory. A collision is an error and leaves the existing source unchanged.

The installer does not replace npm, load code dynamically, or keep installed behavior in the Nara package. The resulting files belong to the application and use its existing TypeScript dependencies. Package dependency changes, if ever required, remain ordinary `package.json` changes.

The architecture engine discovers the installed result from `src/features/*`; no architecture manifest is required. The package directory is a distribution source only and is not itself an application feature.

## Composition dependencies

Packages deliberately carry no dependency metadata. The application
dependency graph stays inferred from TypeScript imports (`nara doctor`,
`nara impact`), so there is exactly one source of architectural truth and
no npm-within-Nara.

When one capability requires another (for example, a hypothetical `users`
package requiring `auth`), the rule is: document the prerequisite in the
package and fail the dependent behavior with a precise message — or bundle
the tightly coupled capabilities as one package. Automatic dependency
installation and manifest resolution are non-goals.

This is why the catalog stays small: the reference application's `auth`
and `users` features depend on shared infrastructure, feature-owned
migrations, and application-level composition, and are therefore not
packaged. A capability joins `official-features/` only when `nara add`
produces source that passes `doctor` with zero changes outside the new
feature directory.
