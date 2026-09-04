# ADR 0012: Architecture-aware change intelligence via `nara diff`

Date: 2026-09-04
Status: Accepted

## Context

`nara inspect`, `context`, and `impact` describe what the architecture
is, and `nara doctor` validates current boundaries. During code review
there was no deterministic answer to how the architecture is changing:
`git diff` explains text changes but not Feature-architecture changes
(added/removed Features, boundary and contract deltas, dependency
edges, surfaces, new versus resolved diagnostics, structural impact).

Review needed a Git-aware command that reuses the existing architecture
facts instead of introducing a second model, manifest, or AI provider.

## Decision

- Add `nara diff --base <git-ref> [--head <git-ref>] [--json]`.
- `--base` is required. Without `--head`, compare the base ref against
  the working tree including uncommitted source changes. With `--head`,
  compare two refs without touching the working tree.
- Introduce one deterministic internal `ArchitectureSnapshot`
  (`schemaVersion: 1`, sorted, no timestamps or absolute paths) derived
  from existing discovery, inspection, and doctor primitives.
- Report architecture changes only: Features, public exports,
  contract exports, dependency edges with deterministic evidence,
  server/web/test surfaces, and doctor diagnostics by stable structural
  identity (never rendered prose alone).
- Compute the affected set from the change plus the dependency graph
  and label it `structural dependency impact` (never semantic behavior).
- Materialize ref state into isolated temporary directories with
  read-only Git plumbing (`ls-tree`, `show`); never checkout, reset,
  stash, clean, or mutate user changes; always clean up; handle paths
  safely. Native Git invocation only (no new dependency).
- Success returns `0` whether or not the architecture changed. Usage
  errors use exit `64`; operational failures (outside a repo, unknown
  ref, unreadable state) fail non-zero with actionable diagnostics.
- No configuration file, manifest, LLM, graph visualization, policy
  DSL, automatic fixes, or platform integrations in this milestone.

## Consequences

Positive:

- Reviews see Feature-architecture deltas and structural dependents in
  one deterministic command, human and JSON.
- Snapshot reuse keeps one architecture model; doctor checks unchanged;
  generated apps and the published package stay minimal.
- Ref-to-worktree covers the main local workflow (`nara diff --base
  main`); ref-to-ref covers committed comparisons without worktree risk.

Negative:

- Full-tree materialization per ref costs Git reads on large repos
  (bounded temp dirs, no caching in this pass).
- Diagnostics identity is structural (`code`, `file`, `relationship`);
  prose-only renames without structural change are intentionally
  invisible.
- Architecture changes never fail the command; enforcement stays a
  later capability.

## Alternatives considered

- **Rely on `git diff` alone** — precise for text, silent on Feature
  boundaries, contracts, edges, surfaces, and structural impact.
- **Generic graph visualization (`nara graph`)** — useful later, not a
  review answer; explicitly deferred.
- **Architecture manifest/config DSL** — new source of truth to drift;
  rejected in favor of deriving from code and convention.
- **AI-generated explanations** — non-deterministic, provider-dependent;
  rejected for core facts (AI may consume the JSON, not define it).
- **Policy enforcement in the same command** — conflates observation
  with gating; deferred to a later capability.
