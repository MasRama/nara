# Skills

Procedural deep dives loaded on demand. Each skill is one directory with a `SKILL.md` (machine-readable `name` + `description` frontmatter).

`AGENTS.md` / `ARCHITECTURE.md` are authority and policy. Skills are
task-specific procedures: they explain how to perform a specific kind of
work and link back to the authoritative docs instead of restating policy.

| Skill | When to load |
|---|---|
| [`nara-feature-development/`](./nara-feature-development/SKILL.md) | Creating or changing a business feature |
| [`nara-api-contracts/`](./nara-api-contracts/SKILL.md) | Hono response shapes, error codes, Zod validation |
| [`nara-auth-rbac/`](./nara-auth-rbac/SKILL.md) | Changing the Auth provider, sessions, permissions, or authorization composition |
| [`nara-database/`](./nara-database/SKILL.md) | SQL, repositories, transactions, database access |
| [`nara-frontend/`](./nara-frontend/SKILL.md) | Vue pages, router, components, typed API clients |
| [`nara-testing/`](./nara-testing/SKILL.md) | Feature, route, repository, Vue, CLI, or architecture tests |

## Loading rules

- Load only the smallest set of procedural skills directly relevant to the current task.
- If guidance conflicts, `AGENTS.md` and `ARCHITECTURE.md` win over skills.
- Skills are procedures, not policy: architecture authority stays in `ARCHITECTURE.md` and `docs/v3/`.

Examples:

```text
database repository change
→ nara-database + nara-testing

Vue Feature page
→ nara-frontend + nara-testing

new full-stack Feature
→ nara-feature-development
   + relevant API/frontend/database/testing skills only as required
```

Do not load `nara-auth-rbac` unless the task actually touches
Auth/session/RBAC/authorization composition.

Superseded skills were removed from this directory at v3.0.0 normalization and during the guidance simplification; preserved copies live in [`docs/archive/v3/skills/`](../../docs/archive/v3/skills/).
