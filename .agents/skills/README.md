# Skills

Procedural deep dives loaded on demand. Each skill is one directory with a `SKILL.md` (machine-readable `name` + `description` frontmatter).

| Skill | When to load |
|---|---|
| [`nara-feature-development/`](./nara-feature-development/SKILL.md) | Creating or changing a business feature |
| [`nara-api-contracts/`](./nara-api-contracts/SKILL.md) | Hono response shapes, error codes, Zod validation |
| [`nara-auth-rbac/`](./nara-auth-rbac/SKILL.md) | Sessions, permissions, role management, guards |
| [`nara-database/`](./nara-database/SKILL.md) | SQL, repositories, transactions, database access |
| [`nara-frontend/`](./nara-frontend/SKILL.md) | Vue pages, router, components, typed API clients |
| [`nara-dependencies/`](./nara-dependencies/SKILL.md) | Before adding or suggesting a dependency |
| [`nara-testing/`](./nara-testing/SKILL.md) | Feature, route, repository, Vue, CLI, or architecture tests |
| [`nara-pitfalls/`](./nara-pitfalls/SKILL.md) | Before writing code — common v3 mistakes |

## Loading rules

- Load every skill relevant to the task.
- If guidance conflicts, `AGENTS.md` and `ARCHITECTURE.md` win over skills.
- Skills are procedures, not policy: architecture authority stays in `ARCHITECTURE.md` and `docs/v3/`.

Superseded v2 planning/reference skills were removed from this directory at v3.0.0 normalization; preserved copies live in [`docs/archive/v3/skills/`](../../docs/archive/v3/skills/).
