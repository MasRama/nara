# Nara v3 Release-Candidate Checklist

Pre-RC gate record. The RC itself (`v3 → main`, tag `v3.0.0`) is created only
after every blocking item passes, including the external cold-start gates.

## What each validation command proves

```text
npm run validate:release
```

Portable pre-RC gates; runs on any platform and never claims Linux evidence:

- `npm run check` — server typecheck, Vue typecheck, unit suite, `nara doctor`
- `npm run test:production-serving` — fresh build, one-origin SPA/assets/API
- `npm run test:production-startup` — blank `APP_URL`, invalid numeric, and
  missing-frontend startups exit non-zero with the cause named; no listener
  remains, no child leaks
- `npm run test:http-stack-compat` — manifest/lockfile/import/adapter audit:
  the Hono HTTP path uses no Ultimate/uWS native HTTP runtime
- `npm run test:new-project` — first-user journey: `nara new`, install,
  typechecks, tests, `doctor`, production build + health
- `npm run test:official-feature` — second journey: `nara add audit` into a
  clean generated project, then typechecks, tests, `check`, `doctor`

```text
npm run validate:linux
```

Linux-only runtime gate (`test:linux-deployment`). Always rebuilds from
source, starts the real production artifact, and proves `GET /health` 200,
`GET /ready` 200, `GET /api/auth/me` 401 plus no uWS mapping in
`/proc/<pid>/maps`. Fails fast with a clear diagnostic on non-Linux instead
of passing silently.

```text
npm run perf:sanity
```

Separate machine-sensitive sanity (`scripts/perf-sanity.mjs`, requires
`npm run build` first). Localhost startup/HTTP/`doctor`/discovery samples
with catastrophic-only tripwires. Not part of `validate:release`; compare
runs on the same host, not across hosts.

CI combines them: `check` + production serving on `ubuntu-latest`, and the
pinned `ubuntu-22.04` compat job runs the portable HTTP audit plus the
production startup smoke (`/health`, `/ready`, `/api/auth/me` → 401) on the
glibc 2.35 baseline.

## Blocking gates before V3-135

- [ ] `npm run validate:release` green on a clean tree
- [ ] `npm run validate:linux` green on Linux (local or `ubuntu-22.04` CI)
- [ ] `npm run perf:sanity` within catastrophic budgets, no new tripwire
- [ ] `tests/integration/*` leave no child process, temp DB, or temp dir
- [ ] V3-133 agent cold-start executed by a genuinely fresh agent and passed
- [ ] V3-134 human cold-start performed by an unfamiliar developer; see
      `docs/v3/human-cold-start.md` (this item needs a real human session)
- [ ] Release notes accurate (`docs/v3/release-notes.md`)
- [ ] Migration guide accurate (`docs/v3/migration-v2-v3.md`)
- [ ] Security docs match implementation (`SECURITY.md`, README deployment)
- [ ] README first-run path works verbatim from a clean clone
- [ ] `package.json` metadata (`name`, `version` 3.0.0, `bin`, `engines`)
- [ ] Architecture fixtures green (valid + intentionally invalid projects)
- [ ] No `v3.0.0` tag/release conflict unresolved (check, do not overwrite)
- [ ] `v3 → main` merge dry-run reviewed (do not merge here)

## Repository metadata timing

The GitHub repository description/topics/homepage currently describe the v2
product on the `main` default branch. Do NOT update them during this pass:
they would contradict the default branch. Update them only after v3 becomes
canonical (`v3 → main` merged):

```text
after v3 becomes canonical/main:
update GitHub repository description/topics/homepage if needed
```

## Merge / tag plan (not executed here)

```text
v3 → main   # only when explicitly instructed
tag v3.0.0  # target = future canonical main/v3 merge result
```

Do not create the tag if `v3.0.0` already exists; report the conflict as a
release blocker instead of overwriting it.
