# ADR 0017: Evolvable open-code lineage

Date: 2026-09-05
Status: Accepted

## Context

Nara's official Features are intentionally open code. `nara add` copies
ordinary TypeScript into an application so developers can inspect, customize,
and own the result. A later official release must not force a choice between
losing those customizations and abandoning upstream fixes.

The repository already has deterministic architecture facts, but it must not
turn update history into a second architecture manifest. Evolution needs a
historical official base for three-way reconciliation while inspect, context,
diff, snapshots, and doctor continue to derive architecture from `src/`.

## Decision

`nara add <feature>` records a minimal local lineage under:

```text
.nara/lineage/official-features/<feature>/
├── base/          exact official source bytes
└── lineage.json   schema version, feature, source kind, SHA-256 digest
```

The digest hashes sorted relative POSIX paths and exact file bytes. The record
contains no timestamps, Git refs, remote URLs, AI output, or application
metadata. The lineage snapshot is private reconciliation state, not an
architecture contract.

`nara evolve <feature>` compares three deterministic inputs:

- `BASE` — the stored official snapshot from the last add or successful evolve
- `LOCAL` — the installed `src/features/<feature>` source
- `INCOMING` — the current official source bundled with the installed Nara CLI

Unchanged files, one-side changes, additions, and deletions are resolved
without a merge. Non-overlapping text changes use the system `git merge-file`
primitive. Independently changed text, binary, and deletion states conflict.
Conflict plans are non-zero and read-only: Nara never writes conflict markers
or a partial Feature.

Before any conflict-free apply, Nara materializes an isolated candidate Feature
and reuses the existing architecture snapshot, diff, affected-set, and
baseline diagnostic identity primitives. Newly introduced diagnostics block
the apply; diagnostics already present in LOCAL are tolerated. A successful
apply replaces LOCAL transactionally and advances BASE to pure INCOMING bytes,
while local-only files remain in the application Feature.

A missing lineage snapshot is bootstrapped only when LOCAL is byte-identical
to INCOMING. Divergent legacy source fails closed because its historical base
cannot be proven. A Feature without a matching official package is
application-owned and is not evolvable.

## Consequences

Positive:

- Official source remains transparent, editable application code.
- Updates are reproducible from local bytes without network services or AI.
- Local customization survives clean evolution cycles.
- Conflicts are explicit and safe to resolve manually.
- Architecture validation protects the candidate before source replacement.
- Lineage can advance independently from Git history and package versioning.

Negative:

- Each installed official Feature stores a duplicate source snapshot.
- Binary and overlapping changes require manual intervention.
- Missing or corrupt lineage intentionally blocks automatic inference.
- `git merge-file` is a required local tool for non-overlapping text merges.
- An official source change can be architecture-safe yet semantically require
  human review; Nara reports structural evidence, not behavior compatibility.

## Alternatives considered

- **Overwrite the installed Feature with the new package** — rejected. It
  destroys local ownership and makes open-code customization unsafe.
- **Use Git history as the base** — rejected. The Feature may be uncommitted,
  copied from another source, or updated outside a matching Git commit; Git is
  not a reliable package lineage authority.
- **Keep only a digest or a manifest** — rejected. A three-way merge requires
  exact BASE file bytes, not merely identity metadata.
- **Add a remote registry or update service** — rejected. The installed CLI's
  bundled official source is the only INCOMING input; no network is required.
- **Ask an AI model to merge or validate architecture** — rejected. The
  reconciliation and architecture candidate gate must remain deterministic,
  inspectable, and reproducible.
- **Read `.nara/lineage` as architecture facts** — rejected. It would couple
  source-derived architecture analysis to mutable local bookkeeping.
