# Nara v3 Human Cold-Start Test (V3-134)

Status: protocol prepared. V3-134 stays open until an unfamiliar developer
performs this session and genuine observations are recorded below.

## For the facilitator

Do not coach. Hand the participant only the prerequisites, the starting
point, the allowed docs, and the tasks. Do not explain Feature boundaries,
`doctor` output, or the expected fix before the session. Answer environment
questions (broken install, proxy, editor) but not Nara questions — "what does
the docs say?" is the only redirect.

## Prerequisites

- Linux or macOS with Node.js 22+ and npm 10+
- Facilitator-only prerequisite (do not read to the participant): confirm the
  checkout is the pre-release `v3` branch before the session:

```bash
git branch --show-current
# must print: v3
```

  Until `v3` is merged to `main`, a default clone lands on v2 — the session
  must run against the actual `v3` checkout (e.g. `git clone --branch v3 …`
  per the pre-release README note).
- A clean `v3` checkout with dependencies installed and the CLI built:

```bash
npm ci
npm run build
node build/src/cli/index.js doctor
```

- A participant who has never used Nara and has not read this file's
  scoring section. Run `node scripts/human-cold-start-check.mjs` to verify
  the starting environment without revealing anything about the tasks.

## Allowed documentation (nothing else)

```text
README.md
docs/v3/cli.md (only if they ask for command syntax)
```

Do not hand them `feature-model.md`, `architecture-philosophy.md`, or this
file. They may discover other docs on their own; note it if they do.

## Tasks (read verbatim to the participant)

1. Create a runnable Nara application called `ledger` next to the checkout,
   install its dependencies, and prove its backend answers `GET /health`.
2. Inside `ledger`, create a Feature called `billing`.
3. Create a second Feature called `customers` that owns a `getCustomer`
   operation.
4. Make `billing` consume `customers`' internal implementation directly
   (not through its public interface) — use your judgment for what
   "internal" versus "public" means here.
5. Run `nara doctor` in `ledger`.
6. Explain in your own words: what is Nara asking you to change, and why?

## Questions to ask afterward

- In one or two sentences, what is Nara for?
- Where does the business capability called `billing` live, and how did
  you find that?
- What did the `doctor` diagnostic point at, and was the suggested fix
  actionable without further help?
- What was the most confusing moment, and what did you try first?

## Success criteria (facilitator scores after the session)

```text
[ ] stated the product thesis (feature-owned, understandable architecture)
[ ] created the project with no undocumented fix
[ ] created both Features with the canonical command
[ ] produced a genuine internal-import violation (not a typo)
[ ] ran doctor unprompted at step 5 and located the diagnostic
[ ] explained the public-boundary correction correctly
```

Record as free text (no fake UX metrics):

```text
- time to first health 200:
- time to doctor diagnostic understood:
- points of confusion (verbatim where possible):
- docs consulted beyond the allowed two:
- facilitator interventions:
```

## Fixture

No scaffolded Features are provided — creating them IS the test. The only
fixture is the clean starting environment verified by:

```bash
node scripts/human-cold-start-check.mjs
```

which checks Node/npm versions, installed dependencies, the built CLI, and a
healthy architecture, then exits non-zero naming the first problem. It never
creates Features or touches the participant's work.

## Result (filled by the facilitator after a real session)

```text
date:
participant background:
allowed docs actually used:
task outcomes (1-6):
answers to debrief questions:
success criteria:
observations:
overall: PASS / FAIL
```

Do not mark TODO V3-134 complete without this section filled from a real
unfamiliar-human session. A harness run is not a human run.
