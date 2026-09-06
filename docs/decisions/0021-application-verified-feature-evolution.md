# ADR 0021: Application-verified Feature evolution

Date: 2026-09-07
Status: Accepted

## Context

ADR 0017 made official Features evolvable: BASE + LOCAL + INCOMING
reconciliation with architecture-regression gating and transactional apply.
That proves the source merge is clean and architecture-safe, but a clean
merge is not a verified application adoption. An upstream Users change can
merge without conflicts while requiring a new host operation
(`canUpdateAccount(actorId, targetAccountId)`), a binding adaptation the
application owns, a package prerequisite, and a forward migration over an
existing database history. None of those are visible to reconciliation plus
`npm run check` alone, and the old wording ("Safe to apply", "Evolution
applied safely") implied a universal safety Nara never established.

## Decision

Introduce the **Feature Transition** as the managed adoption primitive:

- **Lineage** answers where source came from (BASE → INCOMING bytes).
  BASE keeps advancing to pure INCOMING bytes after accepted evolution;
  it is never replaced by the locally customized candidate.
- **Transition** answers what adopting this upstream change requires from
  this application: BASE, LOCAL-start, INCOMING, starting application
  state, candidate application state, obligations, evidence, decision.
- **Candidate** is the exact revisable application state under evaluation:
  reconciled Feature source plus current bindings, provider, composition,
  manifests, tests, migrations, and developer-authored adaptations,
  staged in isolation. Editing the candidate invalidates its evidence.
- **Obligations** are first-class facts (source, boundary, host, binding,
  provider, package, integration, migration, behavioral) derived from
  existing source and compiler evidence. No compatibility DSL.
- **Evidence** attaches to the exact candidate revision and reuses
  existing gates: reconciliation, architecture diff, doctor, TypeScript,
  frontend check, build, application tests, prerequisite compatibility,
  fresh migration rehearsal, existing-history rehearsal.
- **Outcomes** are scoped: VERIFIED (named evidence satisfied for this
  exact candidate), BLOCKED (concrete incompatibility or failed required
  condition), UNVERIFIED (required evidence unavailable, stale, or
  incomplete). Precedence is BLOCKED, then UNVERIFIED, then VERIFIED.
- **Acceptance** is explicit and exact-candidate only. Only VERIFIED
  transitions apply; there is no force-verified path. Applications may
  always edit their own source outside Nara, but Nara never issues false
  verification.
- **Receipts** under `.nara/transitions/<feature>/` explain and reproduce
  the decision (identities, fingerprints, obligations, evidence,
  limitations, outcome, acceptance). They are evidence, never architecture
  truth: architecture stays source-derived.
- **Ownership** is preserved: bindings, provider choice, authorization
  policy, manifests, tests, and data remain application-owned. Nara
  identifies obligations involving them and validates adaptations, but
  never rewrites them, never runs `npm install`, never executes
  production migrations, and never copies production data.
- **Migrations** reuse the SQLite migrator and ledger. Fresh installs and
  cloned representative histories rehearse separately; modified applied
  migrations BLOCK before SQL; same-identity/same-bytes ownership moves
  stay compatible; unsupported scenarios report UNVERIFIED.

Structural compatibility resolves only structure: a binding can compile
while failing application-owned behavioral tests, and the transition
stays BLOCKED until the behavior passes.

## Consequences

Positive:

- Upstream changes arrive with explicit application obligations instead
  of silent assumptions.
- Clean source merge and verified adoption are visibly different states.
- Missing evidence (no history fixture, no toolchain) is reported rather
  than assumed.
- Lineage, receipts, and architecture each keep one job.

Negative:

- Transitions require developer action: adapt bindings, nominate tests,
  provide history fixtures, then accept.
- Conservative invalidation reruns evidence after any relevant candidate
  change; no selective caching in v1.
- Full toolchain evidence needs a complete staged candidate and takes
  longer than a source-only evolve.

## Alternatives considered

- **Keep reconcile-then-apply as the managed path** — rejected. It
  answers what changed upstream but not what the application owes, and
  its wording promised safety it never measured.
- **A generic verification workflow DSL** — rejected. The fixed evidence
  model (canonical gates plus nominated application tests) covers the
  lifecycle without a second orchestration language.
- **Nara-owned test/flag metadata as architecture** — rejected. Evidence
  selection (`.nara/transitions/<feature>.checks.json`) is
  application-owned, never auto-modified, identifies tests only, and
  never defines architecture.
- **Automatic binding rewrites or package installs** — rejected. Those
  are application policy decisions; Nara stops at an explicit obligation
  or UNVERIFIED result.
- **Production migration execution or rollback promises** — rejected.
  Rehearsals run on disposable clones; production stays out of scope.
