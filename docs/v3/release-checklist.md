# Nara v3.0.0 Release Checklist (final)

Final release record. V3-135 (release candidate) was completed after every
blocking gate below passed; V3-136 (final release) transitioned `v3` to
`main`, tagged `v3.0.0`, and published the GitHub release.

Conceptual order:

```text
Technical gates (this file, rerun green)
↓
V3-135 RC (candidate state, no final merge/tag)
↓
Final release review (same finalization run)
↓
V3-136 final release (v3 → main, tag v3.0.0, release actions)
```

## Explicitly out of the release criteria

- **No unfamiliar-human cold-start gate.** V3-134 was removed from the
  release definition by product-owner decision at finalization. Manual
  developer/product validation was performed by the project owner
  continuously throughout v3 development and review. V3-133 agent
  cold-start is the retained cold-start gate.
- **No pinned distribution/glibc baseline.** There is no release
  requirement tied to a specific Ubuntu version, glibc version, or Linux
  distribution compatibility matrix. The requirement is: the built Nara
  application runs correctly on a real Linux environment, and the HTTP
  path does not depend on the removed Ultimate/uWebSockets native HTTP
  runtime. Other native dependencies (`better-sqlite3`, Sharp) are
  legitimate and unrelated to that contract.

## What each validation command proves

```text
npm run validate:release
```

Portable gates; runs on any platform and never claims Linux evidence:

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
source, spawns the real production artifact directly (`node build/server.js`,
no npm wrapper, so the observed PID is the actual server), and proves
`GET /health` 200, `GET /ready` 200, `GET /api/auth/me` 401 plus no uWS
mapping in `/proc/<pid>/maps`. The `/proc` assertion is narrow: it proves no
Ultimate/uWS native HTTP binary is mapped into the running server, not that
all native dependencies are absent. Fails fast with a clear diagnostic on
non-Linux instead of passing silently.

```text
npm run perf:sanity
```

Separate machine-sensitive sanity (`scripts/perf-sanity.mjs`, requires
`npm run build` first). Localhost startup/HTTP/`doctor`/discovery samples
with catastrophic-only tripwires. Not part of `validate:release`; compare
runs on the same host, not across hosts.

## Blocking gates before V3-135

Each checkbox below means "rerun green for the RC candidate on a clean
tree". An unchecked box does not imply the area was never validated —
historical evidence lives in TODO — only that it must be freshly observed
immediately before RC.

- [x] `npm run validate:release` green on a clean tree (2026-09-04 finalization run)
- [x] `npm run validate:linux` green on Linux (2026-09-04 finalization run)
- [x] `npm run perf:sanity` within catastrophic budgets, no new tripwire (2026-09-04)
- [x] `tests/integration/*` leave no child process, temp DB, or temp dir
- [x] Release notes accurate (`docs/v3/release-notes.md`)
- [x] Migration guide accurate (`docs/v3/migration-v2-v3.md`)
- [x] Security docs match implementation (`SECURITY.md`, README deployment)
- [x] README first-run path works verbatim from a clean `main` checkout (canonical clone instructions finalized; first-user journey covered by `test:new-project`)
- [x] `package.json` metadata (`name`, `version` 3.0.0, `bin`, `engines`)
- [x] Architecture fixtures green (valid + intentionally invalid projects, via `npm run check`)
- [x] No `v3.0.0` tag/release conflict unresolved (check, do not overwrite)
- [x] `v3 → main` merge dry-run reviewed (do not merge here)

## V3-135 — Release candidate (not final release)

Create the candidate only after all blocking gates above pass. V3-135 does
NOT include:

```text
v3 → main merge
tag v3.0.0
GitHub release creation
```

No RC version/tag scheme is defined by authority docs; keep V3-135 as a
release-candidate state decision without inventing tags such as
`v3.0.0-rc.1`.

## RC review / observation

After the candidate exists, review and observe before any final action.
Do not merge or tag during observation.

## V3-136 — Final v3.0.0 release

Only after V3-135 and RC observation:

```text
final validation
v3 → main
tag v3.0.0  # target = final canonical main/v3 release commit
release actions
```

Do not create the tag if `v3.0.0` already exists; report the conflict as a
release blocker instead of overwriting it.

After `v3` becomes canonical on `main`:

```text
README uses normal default-branch clone instructions
GitHub repository description/topics updated to v3 wording
```

## Repository metadata timing

The GitHub repository description/topics/homepage described the v2 product
while `main` was still the v2 line. Update them only after v3 becomes
canonical (`v3 → main` merged):

```text
after v3 becomes canonical/main:
update GitHub repository description/topics/homepage
```
