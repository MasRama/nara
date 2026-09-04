# Nara v3.1.0 Release Notes

Status: candidate on `main` (replaces no history; [`release-notes.md`](./release-notes.md) remains the v3.0.0 record).

> Nara can describe not only what the architecture is, but how the architecture is changing.

Progression: v3.0 shipped the persistent architecture-aware application kit;
v3.1 adds architecture change intelligence on top of it.

## What changed since v3.0.0

### Architecture Change Intelligence

New deterministic CLI command:

```text
nara diff --base <ref>
nara diff --base <ref> --head <ref>
nara diff --base <ref> --json
```

`git diff` explains text changes; `nara diff` explains Feature-architecture
changes between a Git base ref and the working tree (or between two refs with
`--head`, without touching the working tree). Detected change categories:

- added/removed Features
- added/removed public boundary and contract exports per Feature
- added/removed Feature dependency edges, with import evidence
- added/removed server/web/test surfaces per Feature
- newly introduced versus resolved `nara doctor` diagnostics
- structurally affected downstream Features (dependency-reachable from a
  changed Feature, labeled structural dependency impact)

This is deterministic structural architecture analysis: no configuration
file, baseline, LLM, or AI provider required. It is not semantic behavior
analysis and not LLM-generated reasoning — `impact`-style structural reach,
never a behavior prediction. See [`cli.md`](./cli.md) and ADR 0012.

### Persistent architecture companion

Generated projects retain exact-pinned local Nara tooling rather than losing
Nara after scaffolding: `nara new my-app` pins the creating CLI version as an
exact `nara` devDependency (no range), and the generated `npm run check` ends
with `nara doctor` run from the project's own install. Architecture-rule
changes arrive only through an explicit dependency update — never silently.

### Publishable CLI boundary

The Nara CLI/package boundary (`packages/nara`, staged via
`npm run stage:package`) is separated from the richer root reference
application, with a version-coherence invariant (`npm run validate:version`,
run first inside `npm run validate:release`) keeping the root manifest, the
publishable manifest, and the lockfile root entries on one version.

### Lifecycle/release reliability

Generated-project lifecycle stabilization and canonical packaged-lifecycle
coverage: source and packaged CLI execution resolve the same owning package
version, and lifecycle tests prove generated applications exact-pin the CLI
version that created them.

## Non-goals (later milestones)

`nara guard`, `nara graph`, `nara affected`, `nara explain`, policy
configuration, baseline files, GitHub PR comments, AI explanations, automatic
fixes, VSCode integration, plugin system.

## Verify

```bash
npm run validate:version   # manifest/lockfile coherence
npm run validate:release   # canonical gate (starts with validate:version)
```

## Read before publishing

- [`README.md`](../../README.md) — first-run overview
- [`ARCHITECTURE.md`](../../ARCHITECTURE.md) — architecture authority
- [`feature-model.md`](./feature-model.md) — Feature ownership and boundaries
- [`cli.md`](./cli.md) — command and JSON reference
- [`release-notes.md`](./release-notes.md) — historical v3.0.0 record
