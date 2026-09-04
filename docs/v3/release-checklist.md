# Nara v3 Release-Candidate Checklist

Pre-RC gate record. V3-135 (release candidate) is created only after every
blocking item below passes, including the external human cold-start gate.
V3-135 is a candidate state only: no final `v3 → main` merge and no final
`v3.0.0` tag. Those belong to V3-136 (final release).

Conceptual order:

```text
Pre-RC gates (this file)
↓
V3-135 RC (candidate state, no final merge/tag)
↓
RC review / observation
↓
V3-136 final release (merge v3 → main, tag v3.0.0, release actions)
```

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

CI combines them: `check` + production serving on `ubuntu-latest`, and the
pinned `ubuntu-22.04` compat job defines the glibc 2.35 compatibility
baseline (portable HTTP audit plus production startup smoke). The local
`validate:linux` run proves Linux runtime behavior on the machine that runs
it; it does not by itself claim execution on glibc 2.35 unless that run is
recorded.

## Already-verified milestone evidence (not a rerun)

- V3-133 agent cold-start: PASSED (see `docs/v3/agent-cold-start.md`).
  Not a gate to re-execute for the RC candidate.

## Blocking gates before V3-135

Each checkbox below means "rerun green for the RC candidate on a clean
tree". An unchecked box does not imply the area was never validated —
historical evidence lives in TODO — only that it must be freshly observed
immediately before RC.

- [ ] `npm run validate:release` green on a clean tree
- [ ] `npm run validate:linux` green on Linux (local run proves local
      behavior; `ubuntu-22.04` CI defines the glibc 2.35 baseline)
- [ ] `npm run perf:sanity` within catastrophic budgets, no new tripwire
- [ ] `tests/integration/*` leave no child process, temp DB, or temp dir
- [ ] V3-134 human cold-start performed by an unfamiliar developer; see
      `docs/v3/human-cold-start.md` (protocol prepared; actual human
      execution pending — this item needs a real human session)
- [ ] Release notes accurate (`docs/v3/release-notes.md`)
- [ ] Migration guide accurate (`docs/v3/migration-v2-v3.md`)
- [ ] Security docs match implementation (`SECURITY.md`, README deployment)
- [ ] README first-run path works verbatim from a clean `v3` checkout
- [ ] `package.json` metadata (`name`, `version` 3.0.0, `bin`, `engines`)
- [ ] Architecture fixtures green (valid + intentionally invalid projects)
- [ ] No `v3.0.0` tag/release conflict unresolved (check, do not overwrite)
- [ ] `v3 → main` merge dry-run reviewed (do not merge here)

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

## V3-136 — Final v3.0.0 release (not executed here)

Only after V3-135 and RC observation:

```text
final validation
v3 → main   # only when explicitly instructed
tag v3.0.0  # target = future canonical main/v3 merge result
release actions
```

Do not create the tag if `v3.0.0` already exists; report the conflict as a
release blocker instead of overwriting it.

After `v3` is merged to `main`:

```text
simplify README clone instructions back to a normal default-branch clone
update GitHub repository description/topics/homepage if needed
```

## Repository metadata timing

The GitHub repository description/topics/homepage currently describe the v2
product on the `main` default branch. Do NOT update them during this pass:
they would contradict the default branch. Update them only after v3 becomes
canonical (`v3 → main` merged):

```text
after v3 becomes canonical/main:
update GitHub repository description/topics/homepage if needed
```
