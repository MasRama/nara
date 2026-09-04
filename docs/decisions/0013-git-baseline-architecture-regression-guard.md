# ADR 0013: Git-baseline architecture regression guard via `nara guard`

Date: 2026-09-04
Status: Accepted

## Context

`nara diff` (ADR 0012) describes how Feature architecture is changing, and
`nara doctor` reports whether the current architecture is healthy. Review
still lacked a deterministic gate: a team adopting Nara on a repository
with existing architecture debt had no way to prevent *new* debt without
first fixing every inherited violation. A ratchet was needed — quality may
stay equal or improve, and new debt cannot enter unnoticed.

## Decision

- Add `nara guard --base <git-ref> [--head <git-ref>] [--json]`.
- `--base` is required and is the regression baseline. No baseline file
  (`.nara-baseline`), no `nara.config.*`, no `architecture.json`, no
  policy file, no ignore/allow lists, no severity configuration. Nara
  derives architecture from code and Git history rather than maintaining
  a second architecture truth.
- Git semantics exactly match `nara diff`: without `--head`, compare the
  base ref against the working tree including uncommitted source changes;
  with `--head`, compare two refs without modifying the working tree.
  Reuse the existing read-only Git materialization (`ls-tree`, `show`);
  no second Git comparison implementation.
- The complete policy: guard fails only when the target introduces one
  or more new `nara doctor` diagnostics that did not exist in the base
  snapshot. Inherited baseline violations do not fail the guard;
  resolved violations are reported positively.
- Architecture changes themselves (added/removed Features, exports,
  contracts, dependency edges, surfaces, affected downstream Features)
  are informational and never fail the guard. Guard enforces existing
  Nara architecture invariants only; no subjective policy is invented.
- Guard shares the architecture comparison model with diff: one
  `ArchitectureSnapshot`, one `diffSnapshots` diagnostic identity
  (`code`, `file`, `relationship`), one `computeAffected` set. The same
  comparison produces the same introduced/resolved classification in
  both commands. Shared internals were refactored only to make this
  ownership clean (`diagnosticKey` export, snapshot-with-issues capture);
  `nara diff` output and behavior are unchanged.
- `nara doctor` remains strict: any diagnostic still fails `doctor`.
  `doctor` is absolute correctness; `guard` is the relative ratchet.
- Exit status follows existing CLI conventions: `0` when guard
  completes with no new violations, `1` when new violations are
  introduced or comparison cannot complete, `64` for invalid arguments.
- JSON uses `schemaVersion: 1` with `passed` true exactly when
  `introducedIssues.length === 0`; introduced/resolved entries reuse the
  existing doctor diagnostic structure with deterministic ordering.
- Generated projects keep `npm run check` on `nara doctor`: a new
  application has no universal Git baseline ref to assume. Guard is
  documented as an explicit CI/review command
  (`npx nara guard --base origin/main`).
- Nara guard is not a generic policy engine: no user-authored rules, severity
  levels, exemptions, suppressions, or plugin system.

## Consequences

Positive:

- Teams with existing debt can adopt the ratchet immediately: current
  debt is acknowledged, new debt fails the gate.
- One deterministic model serves observation (`diff`) and protection
  (`guard`); source and packaged CLI behave identically.
- CI and coding agents get a machine-readable pass/fail with full
  diagnostic facts and the structural review surface.

Negative:

- Baseline debt stays invisible in normal human guard output by design;
  `doctor` remains the command for absolute health.
- Diagnostic identity is structural; prose-only diagnostic renames
  without structural change are intentionally invisible, as in `diff`.
- Full-tree materialization per ref costs Git reads on large repos
  (same bound as `diff`).

## Alternatives considered

- **Baseline files / checked-in snapshots** — a second architecture
  truth that drifts from code; rejected in favor of the Git ref.
- **Failing on any architecture change** — conflates review-worthy
  change with violations; rejected, changes stay informational.
- **Configurable policy engine (severities, exemptions, rules DSL)** —
  massively expands the product surface before the deterministic core
  is mature; explicitly deferred.
- **Weakening `doctor` to tolerate baseline debt** — destroys the
  absolute-health signal; rejected, both commands keep independent
  value.
- **Separate guard comparison implementation** — divergent
  introduced/resolved logic between `diff` and `guard`; rejected in
  favor of shared primitives.
