# LLM Wiki Decision

## Decision

No LLM Wiki is needed for Nara v3.0.

## Evidence

- The v3 architecture is centralized in `V3_SPEC.md` and execution order in `TODO.md`.
- Agent operating rules are centralized in the root `AGENTS.md`; nested agent instructions are not required.
- Architecture facts are derived by deterministic CLI commands instead of repeated session rediscovery.
- The current supplemental decisions are few and targeted under `docs/v3/`; they do not require a second knowledge system.
- There is no observed unresolved session history or architecture ambiguity that a wiki would reduce.

Do not create a `wiki/` tree for v3.0. If repeated rediscovery or dispersed decisions become measurable, add a lightweight derived index without making it authoritative over `V3_SPEC.md`.
