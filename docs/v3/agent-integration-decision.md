# Agent Skill Integration Decision

## Decision

**REJECT FOR V3.0**

Nara v3 does not add a Nara-specific MCP server, agent framework, or large skill. The root `AGENTS.md`, feature conventions, and deterministic `nara inspect`, `nara context`, `nara doctor`, and `nara impact` commands already provide the bounded operational context an agent needs.

There is no measured before/after task showing that another integration improves correctness, scope control, or verification. Adding one now would create another instruction surface without improving the architecture model. Reconsider only after a reproducible benchmark demonstrates a concrete failure that the existing commands cannot address.
