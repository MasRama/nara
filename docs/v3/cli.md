# Nara v3 CLI

The Nara CLI is a TypeScript command-line tool for creating Features, composing official source packages, and inspecting architecture. Core analysis is deterministic and does not call an LLM.

After building or installing the package, the executable is `nara`. From a repository checkout, the equivalent command is:

```bash
node build/src/cli/index.js <command>
```

Run `nara --help` for the command list and `-h`/`--help` for command-specific usage.

## `nara new <name>`

Create a runnable minimal Nara v3 application in a new sibling directory. `nara new` writes the project files but does not install dependencies:

```bash
nara new ledger
cd ledger
npm install
npm run check
npm run build
npm start
```

`npm run check` runs the server typecheck, Vue typecheck, and Vitest tests. `npm start` runs the generated Node server on port `5555` by default; `GET /health` returns `{"status":"ok"}`.

The generated project is intentionally small:

```text
ledger/
├── .gitignore
├── AGENTS.md
├── package.json
├── resources/
│   ├── app.ts
│   ├── index.css
│   └── index.html
├── src/
│   ├── app/
│   │   ├── App.vue
│   │   └── server.ts
│   ├── features/
│   │   └── health/
│   │       ├── index.ts
│   │       └── tests/
│   │           └── health.test.ts
│   └── server.ts
├── tsconfig.frontend.json
├── tsconfig.json
├── vite.config.mjs
└── vitest.config.mjs
```

`resources/app.ts` mounts the Vue 3 browser shell from `src/app/App.vue`. `src/app/server.ts` composes the health Feature's Hono route, and `src/server.ts` serves it through `@hono/node-server`. The starter contains no database or authentication features; add capabilities explicitly with `nara make feature` or `nara add`. The command refuses unsafe names and existing directories; it never merges into or overwrites an existing project.


## `nara make feature <name>`

Create the smallest canonical Feature skeleton in the current project:

```bash
nara make feature billing
```

This creates:

```text
src/features/billing/
├── contract.ts
└── index.ts
```

`contract.ts` exports the generated feature name and type. `index.ts` re-exports the public value. Add `server/`, `web/`, and `tests/` only when the capability needs them. The command validates lowercase kebab-case names and refuses duplicate targets.

## `nara add <feature>`

Install an official open-code Feature package into `src/features/<feature>`:

```bash
nara add health
nara add audit
```

The package is copied as inspectable TypeScript source. Installation refuses unknown package names and existing targets. It stages the copy before renaming it into place, so a failed copy does not leave a partial Feature directory.

Run the architecture check after installation:

```bash
nara doctor
```

## `nara doctor`

Validate repository architecture from `src/features/*`:

```bash
nara doctor
```

The current checks cover:

- Feature shape and public `index.ts`
- cross-Feature internal imports
- circular Feature dependencies
- server-only imports from `web/`

Healthy output is intentionally short:

```text
Architecture looks healthy.
```

An invalid project exits non-zero and prints every issue with its stable code, source file, relationship, reason, and recommended fix. For example, a direct import of `users/server/repository.ts` from `billing` identifies both Features and points to `@/features/users` as the public direction.

### JSON output

Use `--json` for scripts, CI, and agents:

```bash
nara doctor --json
```

A healthy report has this shape:

```json
{
  "healthy": true,
  "issues": []
}
```

An issue includes the same facts as human output:

```json
{
  "healthy": false,
  "issues": [
    {
      "code": "CROSS_FEATURE_INTERNAL_IMPORT",
      "message": "...",
      "file": "src/features/billing/server/routes.ts",
      "relationship": "billing -> users",
      "reason": "Features may communicate only through the target feature public index.",
      "suggestion": "..."
    }
  ]
}
```

## `nara inspect <feature>`

Describe one discovered Feature without opening all source files:

```bash
nara inspect users
```

Human output lists the public exports, dependencies, dependents, server entrypoints, web entrypoints, contracts, and tests.

Use machine-readable output when selecting a bounded change surface:

```bash
nara inspect users --json
```

The result contains these fields:

```json
{
  "name": "users",
  "path": "src/features/users",
  "publicExports": ["..."],
  "dependencies": ["auth"],
  "dependents": [],
  "serverEntrypoints": ["server/routes.ts"],
  "webEntrypoints": [],
  "contracts": ["..."],
  "tests": ["tests/routes.test.ts"]
}
```

Unknown Features return a readable error and exit non-zero. Available Feature names are included when any exist.

## `nara context <feature>`

Produce the bounded context needed to work on a Feature:

```bash
nara context users
nara context users --json
```

Context includes:

- the Feature work directory
- its public boundary
- public Feature dependencies
- dependents
- contract exports
- server, web, and test surfaces

Example JSON:

```json
{
  "name": "users",
  "workDirectory": "src/features/users",
  "publicBoundary": "src/features/users/index.ts",
  "publicDependencies": ["auth -> @/features/auth"],
  "dependents": [],
  "contracts": ["..."],
  "serverSurfaces": ["server/routes.ts"],
  "webSurfaces": [],
  "testSurfaces": ["tests/routes.test.ts"]
}
```

This is a repository fact report, not generated implementation advice. It intentionally does not dump source files.

## `nara impact <feature>`

Show which Features depend on a target in the known Feature graph:

```bash
nara impact auth
nara impact auth --json
```

Example JSON:

```json
{
  "name": "auth",
  "directDependents": ["users"],
  "transitiveDependents": [],
  "scope": "feature dependency graph"
}
```

`impact` reports graph relationships, not semantic business impact. Review contracts and behavior after identifying the affected dependents.

## Exit status and failures

The CLI uses stable categories instead of stack traces for expected failures:

| Status | Meaning |
|---:|---|
| `0` | Command completed successfully |
| `1` | Requested Feature or architecture analysis failed |
| `64` | Invalid command, arguments, Feature/project name, or unknown official package |
| `73` | Duplicate target or filesystem failure |

Expected failures are written as human-readable diagnostics. `--json` is supported by `doctor`, `inspect`, `context`, and `impact`; invalid JSON-mode requests still return a JSON error object where the command accepts the flag.

## Recommended agent loop

```bash
nara context billing --json
# edit only the bounded Feature surface
nara doctor --json
npm run lint
npm test
```

Use `inspect` before opening unrelated files, `context` for a focused implementation handoff, and `impact` before changing a public contract. Nara remains useful when no AI provider is configured.
