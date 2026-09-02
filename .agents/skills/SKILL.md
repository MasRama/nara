# Skills Directory

These skills are deep-dive procedures loaded on demand. Nara v3 guidance is authoritative for current implementation. Historical v2 skills remain available only to explain older decisions and must not be used as implementation instructions.

## Active v3 skills

| Skill | When to load |
|---|---|
| [`vue-patterns.md`](./vue-patterns.md) | Vue 3 pages, components, composables, feature-scoped browser clients, and Vite frontend work |
| [`sqlite-usage.md`](./sqlite-usage.md) | SQL queries, `better-sqlite3` repositories, transactions, dynamic updates, or database access |
| [`auth-rbac.md`](./auth-rbac.md) | Auth guards, permission checks, role management, and session handling |
| [`api-contract.md`](./api-contract.md) | Hono response shapes, error codes, error handling, and Zod validation |
| [`dependency-policy.md`](./dependency-policy.md) | Allowed versus banned dependencies and adding a new package |
| [`common-pitfalls.md`](./common-pitfalls.md) | Before writing code, to avoid common v3 architecture and boundary mistakes |
| [`testing-pattern.md`](./testing-pattern.md) | Feature, Hono route, repository, Vue, CLI, and architecture tests |

## Historical v2 skills — do not load for v3 implementation

| Skill | Historical scope | Current replacement |
|---|---|---|
| [`inertia-patterns.md`](./inertia-patterns.md) | Inertia, Svelte, and Bits UI frontend patterns | [`vue-patterns.md`](./vue-patterns.md), [`V3_SPEC.md`](../../V3_SPEC.md) §7 |
| [`crud-pattern.md`](./crud-pattern.md) | v2 technical-layer CRUD workflow and frontend assumptions | [`V3_SPEC.md`](../../V3_SPEC.md), [`docs/v3/feature-model.md`](../../docs/v3/feature-model.md) |
| [`new-world.md`](./new-world.md) | v2 starter planning and inventory assumptions | [`V3_SPEC.md`](../../V3_SPEC.md), [`TODO.md`](../../TODO.md) |
| [`pentest-pattern.md`](./pentest-pattern.md) | v2 security-testing paths and stack inventory | Current v3 source tree, [`V3_SPEC.md`](../../V3_SPEC.md) |

## Skill format

Each skill uses frontmatter with a `trigger`. Superseded skills additionally declare `status: superseded-v2` and `superseded_by`, and carry a historical-context banner. Do not copy their old framework or layer assumptions into v3 code.

## Loading rules

- Root and nested `AGENTS.md` files provide orientation and are always loaded.
- Load every active skill relevant to the task.
- If guidance conflicts, `AGENTS.md` and `V3_SPEC.md` win over skills.
- Never use a historical v2 skill as a v3 implementation recipe.
