# Installable Feature Format

Nara v3 installs open source code into `src/features/<name>/`. The installed files become ordinary project source: users can inspect, edit, test, and remove them without an opaque runtime.

## Package shape

An official package is a directory named for the feature. Its contents mirror the destination feature directory:

```text
<feature-package>/
├── index.ts
├── contract.ts             # when the feature has a typed boundary
├── server/                  # when the feature owns server behavior
├── web/                     # when the feature owns client behavior
└── tests/                   # when the feature ships behavior tests
```

Empty directories and placeholder files are not part of the format. A package contains only code that the capability needs. `index.ts` is the public boundary when the package exposes cross-feature behavior.

## Installation

`nara add <name>` resolves an official package, checks the destination before writing, and copies its files to `src/features/<name>/`. It never merges into an existing same-name directory. A collision is an error and leaves the existing source unchanged.

The installer does not replace npm, load code dynamically, or keep installed behavior in the Nara package. The resulting files belong to the application and use its existing TypeScript dependencies. Package dependency changes, if ever required, remain ordinary `package.json` changes.

## Discovery

The architecture engine discovers the installed result from `src/features/*`; no architecture manifest is required. The package directory is a distribution source only and is not itself an application feature.
