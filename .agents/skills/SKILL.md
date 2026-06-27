---
authority: canon
owner: masrama
last_verified: 2026-06-28
---

# Skills Directory

> **Authority:** canon — current source of truth for skill file conventions.

Skills are deep-dive procedures loaded on demand. Each skill focuses on one pattern with detailed rules, code examples, and do/don't lists. The agent reads these when it needs to follow a specific pattern.

## Available Skills

| Skill | When to load |
|---|---|
| [`crud-pattern.md`](./crud-pattern.md) | Adding a new resource (types → migration → queries → validator → handlers → routes → page) |
| [`sqlite-usage.md`](./sqlite-usage.md) | Writing SQL queries, transactions, dynamic updates |
| [`auth-rbac.md`](./auth-rbac.md) | Auth guards, permission checks, role management |
| [`inertia-patterns.md`](./inertia-patterns.md) | Frontend pages, `res.inertia` vs `jsonSuccess`, `router.visit` vs `axios` |
| [`error-handling.md`](./error-handling.md) | Error responses in handlers vs deep services, NaraError type guards |
| [`api-contract.md`](./api-contract.md) | Response shapes, response helpers, error codes, pagination meta |

## Skill Format

Each skill file uses this structure:

```markdown
---
authority: canon
owner: <github-username>
last_verified: YYYY-MM-DD
trigger: <when agent should load this skill>
---

# <Skill Name>

> **Authority:** canon — current source of truth for <topic>.

## When to use
## Pattern
## Examples
## Do / Don't
```

## Loading Rules

- AGENTS.md (root + nested) = orientation, always loaded
- Skills = execution, loaded on demand
- If a task touches multiple skills, load all relevant ones
- If guidance conflicts, AGENTS.md wins over skills (skills are derived)
