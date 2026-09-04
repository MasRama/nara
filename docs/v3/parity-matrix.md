# Nara v3 Parity Matrix (V3-045)

Concise map from preserved/replaced v2 capabilities to executable v3 tests.
Full inventory: `docs/v3/v2-inventory.md`. Audit: TODO V3-036–V3-044.

Legend: **PRESERVED** = behavior kept as-is · **REIMPLEMENTED** = behavior
kept, implementation replaced · **REMOVED** = intentionally dropped, guarded
by regression tests · **N/A** = not applicable to v3.

## User-facing capabilities

| Capability | Status | Executable coverage |
|---|---|---|
| Registration, duplicate registration | REIMPLEMENTED | `src/features/auth/tests/routes.test.ts`, `browser.test.ts` |
| Login, wrong-password login | REIMPLEMENTED | `src/features/auth/tests/routes.test.ts`, `browser.test.ts` |
| Session bootstrap, protected route, guest-only route | REIMPLEMENTED | `src/features/auth/tests/browser.test.ts` |
| Logout, logout CSRF + limiter parity | REIMPLEMENTED | `src/features/auth/tests/browser.test.ts`, `src/shared/security/tests/security.test.ts` (logout parity) |
| Dashboard surface | REIMPLEMENTED | `src/features/users/tests/browser.test.ts` |
| Profile load/edit | REIMPLEMENTED | `src/features/users/tests/routes.test.ts`, `browser.test.ts` |
| Password change | REIMPLEMENTED | `src/features/auth/tests/password.test.ts` |
| Avatar upload valid/invalid, serving | REIMPLEMENTED | `src/features/users/tests/assets.test.ts`, `src/shared/security/tests/security.test.ts` (multipart bound) |
| Users list/search/pagination/CRUD | REIMPLEMENTED | `src/features/users/tests/admin.test.ts`, `routes.test.ts` |
| Role assignment, roles CRUD, permissions | REIMPLEMENTED | `src/features/auth/tests/access.test.ts`, `rbac-browser.test.ts` |
| RBAC restrictions, protected admin, self-delete/demotion, last-admin | REIMPLEMENTED | `src/features/auth/tests/access.test.ts`, `rbac-browser.test.ts`, `src/features/users/tests/admin.test.ts` |
| Landing CTA, logout transition | REIMPLEMENTED | `tests/v3/frontend.test.ts`, `src/features/users/tests/browser.test.ts` |
| Browser 404 (Vue surface) | REIMPLEMENTED | `tests/v3/frontend.test.ts` (404 surface) |
| Missing asset → HTTP 404, traversal rejection | REIMPLEMENTED | `tests/integration/production-serving.test.ts` |
| Missing API → backend 404 (never SPA HTML) | REIMPLEMENTED | `tests/integration/production-serving.test.ts`, `src/app/observability.test.ts` |
| Health/readiness | REIMPLEMENTED | `official-features/health/tests/health.test.ts`, `tests/v3/health.test.ts` |
| Production SPA + static delivery + caching | REIMPLEMENTED | `tests/integration/production-serving.test.ts` |
| Vite dev topology + `/api` proxy | REIMPLEMENTED | `tests/v3/vite-topology.test.ts` (+ behavior suites above) |

## Configuration

| Capability | Status | Executable coverage |
|---|---|---|
| `APP_URL` required in production, dev defaults | PRESERVED | `tests/v3/config.test.ts` |
| `DB_FILE` behavior | PRESERVED | `tests/v3/database-lifecycle.test.ts`, `src/shared/database` suite |
| Invalid security numerics, `TRUST_PROXY` validation | PRESERVED | `tests/v3/config.test.ts` |
| Production defaults (`LOG_LEVEL=info`) | REIMPLEMENTED | `tests/v3/config.test.ts` |

## Database lifecycle (V3-035, referenced not duplicated)

Forward migrations, checksums, concurrent migrate, seeds, admin bootstrap,
backup, integrity: `tests/v3/database-lifecycle.test.ts`.

## Security controls (V3-043)

Headers/CSP/HSTS, CSRF double-submit, global + auth limiters, login
identifier/IP lockout, body MIME-confusion matrix, multipart bounds,
fail-safe inspection, limiter/throttle saturation fail-closed, proxy trust
(incl. `HOPS=2` and short-chain fallback), input normalization:
`src/shared/security/tests/security.test.ts` plus the production header
smoke in `tests/integration/production-serving.test.ts`.

## Observability (V3-044)

Request IDs (generate/propagate/replace), structured lifecycle logging,
health exclusion, error correlation, compression, session startup + periodic
cleanup, shutdown: `src/app/observability.test.ts`.

## Architecture CLI

`doctor`, `inspect`, `context`, `impact`, `make feature`, `add`, `new`:
`src/cli/**/tests`, `tests/v3/cli-failure-paths.test.ts`,
`tests/integration/new-project.test.ts`,
`tests/integration/add-official-feature.test.ts`.
Generated project stays minimal: `src/cli/tests/new-project.test.ts`.

## Intentionally removed (guarded, not ported)

Ultimate Express, uWebSockets.js, Express `compression`, Svelte,
`@inertiajs/svelte`, Nuxt, React, Redis, SSR, generic layer-first runtime:
`tests/v3/removed-stack.test.ts` (manifest + source scan) and the generated
project obsolete-stack assertion in `src/cli/tests/new-project.test.ts`.

## Division of responsibility (browser)

- Real Vite topology smoke (`tests/v3/vite-topology.test.ts`): Vite serves
  `/` + `/login`, `/health` and `/api/*` proxy to Hono.
- Behavior-level Vue integration (`tests/v3/frontend.test.ts`, Feature
  `browser.test.ts` suites): navigation, forms, guards, transitions.
- Production topology (`tests/integration/production-serving.test.ts`):
  built SPA, assets, API, headers from one Node process.

No heavy browser automation stack: authenticated flows are proven at the
Vue-integration and Hono-integration levels above.
