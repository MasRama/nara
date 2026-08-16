---
trigger: Creating a new project from the Nara starter — research the repo, write a comprehensive .nara/PRD.md, get user approval, then write the full execution .nara/TODO.md. Planning ONLY — execution is a separate later step.
---

# New World: Plan a New Project from Nara (PRD + TODO only)

## When to use

Starting a NEW project built on top of this starter kit. New World produces EXACTLY TWO artifacts — nothing else:

1. `.nara/PRD.md` — comprehensive product requirements
2. `.nara/TODO.md` — complete execution checklist derived from the PRD

New World does NOT execute anything: no rename, no git reset, no features, no code. Execution happens later, driven by the TODO. The job here is research + planning only.

## Pattern

### 1. Research the repo first

Before writing anything, survey the whole starter so the PRD and TODO are grounded in reality:

- Run `grep -ril "nara" . --exclude-dir=node_modules --exclude-dir=.git` — case-insensitive (`nara`, `Nara`, `NARA`). Verify EVERY hit; the rename inventory below is the reference, not the ceiling.
- Check `package.json` (name, description, scripts), `.env` / `.env.example` / `.env.production.example`, `AGENTS.md` + nested `AGENTS.md`, `resources/inertia.html`, `resources/Pages/*`, `resources/Components/*`, `seeds/*`, `public/` (logo + landing images), `SECURITY.md`, `scripts/`, `tests/`, `database/`
- List the starter's reusable building blocks for the new project: auth/RBAC, resources, pages, components

The rename inventory below is the reference — the TODO must cover every item in it.

### 2. Ask the user

Ask FIRST — never invent the project identity:

- Project name (title / brand — drives `package.json`, `<title>`, headers, README)
- Vision: one line on what the project does
- Goals & success metric: what counts as success (drives PRD Goals + Success metrics — numbers where measurable)
- New git remote URL (optional — lands in the landing hero `git clone` command and GitHub links)
- Admin seed email (`seeds/03_admin.ts`)
- Initial roles/permissions set
- Deployment target (drives Phase 5 + `APP_URL` in `.env.production.example`)
- Core type names: keep `NaraRequest`/`NaraResponse`/`NaraMiddleware`/`NaraHandler` (recommended — 69 refs across 35+ files plus the generator template) or rename (mechanical: LSP rename + update `scripts/gen-resource.ts` + tests)
- Branding direction: palette, fonts, visual tone (feeds Phase 4 UI rewrite)

**95% confidence rule:** if anything is unclear — feature scope, page content, brand details, technical choices — and your confidence is below 95/100, ask the user. Never guess, never fill gaps with assumptions. One round of questions up front is cheaper than redoing a feature.

### 3. Write `.nara/PRD.md`

`.nara/` is project planning — COMMIT it, never gitignore it (same class as `docs/decisions/`).

The PRD is the contract for the whole project — write it COMPREHENSIVE, not a stub. 2026 best practice (PM and AI-agent oriented):

- Start with the problem and goals, not the solution — every goal carries a number where measurable
- Structure over prose: bullets, numbered requirements, tables, headers — agents parse structure and skim prose
- Aim 800–2000 words: under 800 leaves too much to the agent's imagination, over 2000 burns context window
- Every requirement gets an ID (`P0-1`) and an observable, machine-checkable acceptance line — "intuitive", "nice", "smooth" are NOT acceptance criteria; a test, API call, or artifact read is
- Every edge case converts into an acceptance criterion (Given-When-Then)
- Keep an `Open questions` section — anything unresolved is answered with the user BEFORE the TODO is written

```markdown
# <Project Name> — PRD

> Status: Draft | In Review | Approved · Version: 0.1 · Date: <YYYY-MM-DD>
> Revisions: v0.1 initial draft; v0.2 <what changed>

## TL;DR
2–4 sentences: what is being built, for whom, by when, and what counts as success. The section the executor reads first and references when making a choice.

## Goals
- Business goals — each with a number where measurable: <target>
- User goals — each with a number where measurable: <target>

## Personas
2–3 primary users. Each: name, role/context, one friction point. Three sentences each, no backstory.
1. <Name>, <role> — <context>. Needs <goal>. Struggles with <friction>.

## Functional requirements
Numbered, priority-coded, each with an acceptance line (observable and machine-checkable).
- P0-1. <requirement>. Acceptance: <test/API/artifact-verifiable result>
- P1-1. <requirement>. Acceptance: <...>
- P2-1. <requirement>. Acceptance: <...>

## UX flows
Per screen/state: what data is shown, what actions exist, what happens on success AND failure.
- <Page/flow> — shows: <data>. Actions: <list>. Success: <result>. Failure: <error state>.

## Data model & resources
- Resource A — fields, relations, who manages it (each maps to one `gen:resource` cycle in the TODO)
- Resource B — ...

## Non-functional requirements
- Performance, security, a11y, i18n — as applicable, each with an acceptance line.

## Success metrics
- User-centric, business, technical — each with a target number. Mark N/A where a metric is not meaningful for this project.

## Technical considerations
- Stack: Nara starter defaults (ultimate-express, better-sqlite3, Svelte 5 + Inertia, Zod, raw SQL). Deviations must be explicit here.
- Core type names: keep `NaraRequest`/`NaraResponse`/`NaraMiddleware` or rename (user decision — record it)
- Integrations, third-party services, constraints

## Out of scope (non-goals)
- Explicitly not built in v1. The executor will otherwise build what you didn't ask for.

## Branding & content
- Name, tagline, palette, fonts, tone; which starter copy survives and which is rewritten.

## Deployment
- Target platform, domain, expected traffic (drives Phase 5 production readiness).

## Dependencies & risks
- External dependencies; risks with mitigations.

## Edge cases & error states
- e.g. empty states, validation failures, auth expiry — EACH converts to an acceptance criterion above.

## Open questions
- Anything unresolved — answered with the user before the TODO is written

## Acceptance criteria
- Every P0/P1 requirement's acceptance line passes
- `npm run check` passes.
```

### 4. User approves the PRD — gate

Do NOT write the TODO before the user explicitly approves the PRD:

- Present the PRD; ask for approval
- Revisions → update the PRD → ask again
- Only after approval, proceed to the TODO

### 5. Write `.nara/TODO.md`

The TODO is the complete execution plan derived from the PRD. It MUST cover:

- Every rename item from the rename inventory (title, env, seeds, core types, AGENTS.md, ...)
- Every PRD feature, ordered: auth → resources (per P0/P1) → UI rewrite → production
- Tests, verification, and finish steps

Execution is not your job — completeness is. Every item maps to a skill to load.

**Coverage check before hand-off:** re-run `grep -ril "nara"` and map EVERY hit file to its TODO line. A hit with no line is a missing item — fix the TODO. Kept identities (e.g. core type names) are documented exceptions, listed in `.nara/TODO.md`, never silent leftovers.

```markdown
# <Project Name> — TODO

> Derived from `.nara/PRD.md` v<X> (<date>). If the PRD changes after approval, update this TODO before execution.
> Each phase ends with a binary gate — the phase is done ONLY when the gate passes.

## Phase 1: Foundation (rename — skill: new-world inventory)
- [ ] Git: `rm -rf .git && git init` — confirm with user first (destructive)
- [ ] Rename `package.json` — name, description (then `npm install` regenerates `package-lock.json`)
- [ ] Rename `resources/inertia.html` — `<title>`, favicon `/public/<name>.png`
- [ ] Update brand text — Header, landing, auth pages, profile (copy + © footer)
- [ ] Update landing GitHub URLs — hero `git clone` command + all `github.com/...` links
- [ ] Update seed — `seeds/03_admin.ts` admin email
- [ ] Update env — `.env`, `.env.example`, `.env.production.example`, `database/*.sqlite3` paths
- [ ] Update assets — `public/nara.png` + `public/landing/*.webp` (replace or rename + update refs)
- [ ] Update `SECURITY.md` — name refs
- [ ] Update `scripts/pre-commit` — banner text
- [ ] Code-level types — rename `NaraRequest`/`NaraResponse`/`NaraMiddleware` via LSP + update `scripts/gen-resource.ts` template + tests, OR document as kept exceptions (see PRD decision)
- [ ] Update `README.md` — title, badges, links
- [ ] Update `AGENTS.md` + nested AGENTS.md — name refs + Structure tables (check:agents)
- [ ] Sweep `grep -ril "nara"` — zero hits, or every remaining hit is a documented exception
- **Gate:** `npm run check` green AND every grep hit maps to a line above or a documented exception.

## Phase 2: Auth & roles (skill: auth-rbac)
- [ ] Configure initial roles/permissions + seeders (admin email already updated in Phase 1)
- **Gate:** seeded roles/permissions exist in the DB; auth + roles tests pass.

## Phase 3: Resources (skill: crud-pattern — one cycle per resource)
- [ ] Resource <name> — `npm run gen:resource <name> -- --fields="..."`
- [ ] Resource <name> page polish (skill: inertia-patterns)
- [ ] Resource <name> tests (skill: testing-pattern)
- **Gate per resource:** CRUD verified end-to-end — page renders, api returns jsonSuccess/jsonError correctly, resource tests pass.

## Phase 4: UI rewrite (skill: inertia-patterns)
- [ ] Rewrite landing page — full rebrand: copy, brand, layout (not a patch)
- [ ] Rewrite auth pages (login, register) — brand + copy
- [ ] Rewrite app shell: header, nav, footer, profile page
- [ ] Dark mode — verify palette end-to-end: no hardcoded colors, no broken contrast, no visual errors
- [ ] Sweep every page for leftover "Nara"/"NARA" text and wrong branding
- **Gate:** every page in the PRD UX flows renders with correct brand and success/failure states; no leftover brand text.

## Phase 5: Production readiness
- [ ] `npm run build` — production build passes
- [ ] Verify production env (`.env.production.example` — `APP_URL`, `DB_FILE`) and config against the PRD deployment target
- **Gate:** production build green; env matches the PRD Deployment section.

## Phase 6: Finish
- [ ] README — project-specific setup and feature docs
- [ ] `npm run check` — full suite green
- [ ] Initial commit
- **Gate:** every PRD acceptance criterion met; `npm run check` green; initial commit made.
```

### 6. Hand off — stop

Deliver both files and report: PRD approved, TODO complete. Execution is a separate step (user or another agent run) — do NOT start it yourself.

## Rename inventory (reference for the TODO)

Never trust a hardcoded list — re-run `grep -ril "nara"` during research and verify EVERY hit. Known locations:

| Where | What | Note |
|---|---|---|
| `package.json`, `package-lock.json` | name, description | `npm install` regenerates the lock file |
| `resources/inertia.html` | `<title>NARA - ...`, favicon `/public/nara.png` | — |
| `resources/Components/Header.svelte` | brand text (desktop + mobile menu) | — |
| `resources/Pages/landing.svelte` | brand text, hero copy, footer, **GitHub URLs** (hero `git clone` + 4 links) | clone command is user-facing copy |
| `resources/Pages/auth/login.svelte`, `register.svelte` | brand text, © footer | — |
| `resources/Pages/profile.svelte` | "Nara's backend" copy | — |
| `public/nara.png`, `public/landing/*.webp` | logo + 6 hero images | replace or rename + update refs |
| `seeds/03_admin.ts` | `admin@nara.dev` seed email | new project needs its own admin identity |
| `app/core/types.ts`, `index.ts`, `App.ts`, `Router.ts`, `adapters/types.ts` | `NaraRequest`, `NaraResponse`, `NaraMiddleware`, `NaraHandler`, `NaraApp`, `NaraRouter` | DECIDE with user: rename or keep (recommended: keep) |
| `app/handlers/*.ts`, `app/middlewares/*.ts`, `app/services/Authenticate.ts` | `NaraRequest`/`NaraResponse` type imports (~69 refs, 35+ files) | follow the type decision; LSP rename if renaming |
| `scripts/gen-resource.ts` | handler template emits `NaraRequest`/`NaraResponse` | MUST match the type decision or new resources regress to old names |
| `scripts/pre-commit` | banner echo "Nara pre-commit check" | cosmetic, but a grep hit |
| `SECURITY.md` | name refs | — |
| `README.md` | title, badges, links | — |
| `AGENTS.md` + nested AGENTS.md | name references; nested `handlers/AGENTS.md` code examples contain `NaraRequest` | renaming a listed file → update its Structure table (check:agents) |
| `tests/` | `test@nara.dev` emails, `nara-storage-test` tmpdir, `NaraRequest` in `helpers/mocks.ts` + `core/Router.test.ts` | emails/tmpdir cosmetic; type refs follow the type decision |
| `database/*.sqlite3` + `.env*` | db file paths | fresh db regenerates on `migrate` |

Rules:

- Search case-insensitively; rename file contents AND file names.
- If a file was renamed, update every import/reference (use LSP rename where available).
- If renaming core types: LSP rename `NaraRequest` → `<Name>Request` across the repo, THEN update `scripts/gen-resource.ts` template strings and `tests/helpers/mocks.ts` — the generator otherwise re-introduces old names on the first new resource.
- Fresh db files regenerate on `migrate` — deleting `database/dev.sqlite3` is safe when the name changes.
- Final sweep: `grep -ril "nara" . --exclude-dir=node_modules --exclude-dir=.git` — zero hits, or every remaining hit is an intentional exception (e.g. kept type names) recorded in `.nara/TODO.md`. Silent leftovers are bugs.
- After the last hit: `npm run check`.

## Examples

Start the research sweep with one command:

```bash
grep -ril "nara" . --exclude-dir=node_modules --exclude-dir=.git
```

Then edit each hit (see inventory table above for what each file needs).

## Do / Don't

- **Do** research the repo first — the PRD and TODO must be grounded in what actually exists.
- **Do** ask the user for project name, vision, and branding — before anything else.
- **Do** ask the user about the code-level identity (core type names) — the biggest blind spot of this skill; the decision must be explicit in the PRD.
- **Do** write the PRD comprehensive — every page, flow, edge case, and acceptance criterion; gaps are bugs.
- **Do** write requirements numbered with per-item acceptance lines (`P0-1. ... Acceptance: ...`) — structure is followed, prose is skimmed; "intuitive"/"nice" are not acceptance.
- **Do** gate the TODO on explicit PRD approval — no approval, no TODO.
- **Do** make the TODO cover every rename inventory item and every PRD feature — completeness is the job.
- **Do** cross-check every grep hit file against a TODO line before delivering — a hit without a plan line is a missing item.
- **Do** ask the user whenever confidence is below 95/100 — PRD content, branding, UI direction, anything unclear.
- **Do** commit `.nara/` — planning travels with the repo.
- **Don't** execute anything — no rename, no git reset, no code. New World writes PRD + TODO only.
- **Don't** guess or invent specs — the 95% confidence rule applies to everything in `.nara/`.
- **Don't** skip rename items in the TODO — title, env, seeds, core types, AGENTS.md and friends are part of the plan.
- **Don't** treat grep hits outside the inventory as noise — verify every hit and either plan a fix or document why it stays.
- **Don't** write the TODO before PRD approval.
