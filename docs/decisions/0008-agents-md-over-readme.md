# ADR 0008: AGENTS.md as primary AI context

Date: 2025-06-28
Status: Accepted

## Context

AI coding assistants (Claude, Cursor, Windsurf, Devin, Copilot) need project context to generate correct code. Without context, they:
- Guess conventions (often wrong)
- Suggest patterns from other frameworks (ORMs when the project uses raw SQL)
- Miss architectural constraints (layer boundaries)
- Repeat mistakes across sessions (no memory)

README.md is for humans. It explains what the project IS, not how to work IN it. AI needs different information: conventions, anti-patterns, file structure, where to put things.

## Decision

Use `AGENTS.md` as the primary AI context file, with nested AGENTS.md files per directory and skills for deep dives.

Structure:
- `AGENTS.md` (root) — orientation, conventions, anti-patterns, skill index (<200 lines)
- `app/AGENTS.md`, `routes/AGENTS.md`, etc. — directory-specific conventions
- `.agents/skills/*.md` — on-demand deep dives (crud-pattern, sqlite-usage, auth-rbac, etc.)
- `CODEMAP.md` — auto-generated codebase topology index
- YAML frontmatter with `authority: canon` and `last_verified` date

## Consequences

Positive:
- Universal — AGENTS.md is read by Claude, Cursor, Windsurf, Devin, and Copilot
- Layered — AI reads root for orientation, loads skills only when relevant (saves context window)
- Verifiable — `npm run check:freshness` detects stale docs, `npm run lint:layers` enforces conventions
- Self-documenting — the conventions ARE the documentation, no separate wiki needed

Negative:
- Maintenance burden — AGENTS.md must be updated when conventions change (mitigated by freshness gate)
- Not standardized — AGENTS.md format varies by project (mitigated by YAML frontmatter + authority metadata)
- Duplicates some README content — acceptable, different audiences

## Alternatives considered

- **README.md only** — written for humans, not AI. Missing conventions, anti-patterns, file-by-file guidance.
- **.cursorrules / .windsurfrules** — vendor-specific. Locks project to one AI tool.
- **CONTRIBUTING.md** — process-focused (how to submit PRs), not code-focused (how to write code).
- **Inline comments only** — AI reads them but they're scattered. No global view of conventions.
