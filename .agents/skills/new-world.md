---
trigger: Creating a new project from the Nara starter — research the repo, write a comprehensive .nara/PRD.md, get user approval, then write the full execution .nara/TODO.md
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

- Run `grep -ri "nara"` (case-insensitive: `nara`, `Nara`, `NARA`) — every identity location (see rename inventory below)
- Check `package.json` scripts, `.env` / `.env.production.example`, `AGENTS.md` + nested AGENTS.md, `resources/inertia.html`, pages, `database/`
- List the starter's reusable building blocks for the new project: auth/RBAC, resources, pages, components

The rename inventory below is the reference — the TODO must cover every item in it.

### 2. Ask the user

Ask FIRST — never invent the project identity:

- Project name (title / brand — drives `package.json`, `<title>`, headers, README)
- Vision: one line on what the project does
- Optional: new git remote URL

**95% confidence rule:** if anything is unclear — feature scope, page content, brand details, technical choices — and your confidence is below 95/100, ask the user. Never guess, never fill gaps with assumptions. One round of questions up front is cheaper than redoing a feature.

### 3. Write `.nara/PRD.md`

`.nara/` is project planning — COMMIT it, never gitignore it (same class as `docs/decisions/`).

The PRD is the contract for the whole project — write it COMPREHENSIVE, not a stub:

- Cover every page and flow the app will have: landing, auth, dashboard, resources, profile — each with what it shows, who reaches it, and key actions
- Every feature gets observable acceptance criteria
- Include non-goals, edge cases, and error states (empty states, validation failures, auth expiry)
- Prioritize features (P0 must-have / P1 should-have / P2 nice-to-have)
- Keep an `Open questions` section — anything unresolved is answered with the user BEFORE the TODO is written

```markdown
# <Project Name> — PRD

## Vision
One paragraph: what this project is and why it exists.

## Audience
Who uses it.

## Pages & flows
- Page/flow A — what it shows, who reaches it, key actions
- Page/flow B — ...

## Features (in scope)
- Feature A — acceptance: <observable result>
- Feature B — acceptance: <observable result>

## Non-goals
- Explicitly out of scope for v1.

## Prioritization
- P0 (must have): ...
- P1 (should have): ...
- P2 (nice to have): ...

## Edge cases & error states
- e.g. empty states, validation failures, auth expiry

## Open questions
- Anything unresolved — answered with the user before the TODO is written

## Acceptance criteria
- `npm run check` passes.
```

### 4. User approves the PRD — gate

Do NOT write the TODO before the user explicitly approves the PRD:

- Present the PRD; ask for approval
- Revisions → update the PRD → ask again
- Only after approval, proceed to the TODO

### 5. Write `.nara/TODO.md`

The TODO is the complete execution plan derived from the PRD. It MUST cover:

- Every rename item from the rename inventory (title, env, AGENTS.md, ...)
- Every PRD feature, ordered: auth → resources (per P0/P1) → UI rewrite → production
- Tests, verification, and finish steps

Execution is not your job — completeness is. Every item maps to a skill to load.

```markdown
# <Project Name> — TODO

## Phase 1: Foundation
- [ ] Git: `rm -rf .git && git init` — confirm with user first (destructive)
- [ ] Rename `package.json` — name, description
- [ ] Rename `resources/inertia.html` — `<title>`, favicon `/public/nara.png`
- [ ] Rename brand component `NaraIcon.svelte` — file + imports + alt text
- [ ] Update brand text — Header, landing, auth pages, profile (copy + © footer)
- [ ] Update env — `.env`, `.env.production.example`, `database/*.sqlite3` paths
- [ ] Update `README.md` — title, badges, links
- [ ] Update `AGENTS.md` + nested AGENTS.md — name refs + Structure tables
- [ ] `npm run check` — all gates green

## Phase 2: Auth & roles (skill: auth-rbac)
- [ ] Configure initial roles/permissions + seeders

## Phase 3: Resources (skill: crud-pattern — one cycle per resource)
- [ ] Resource <name> — `npm run gen:resource <name> -- --fields="..."`
- [ ] Resource <name> page polish (skill: inertia-patterns)
- [ ] Resource <name> tests (skill: testing-pattern)

## Phase 4: UI rewrite (skill: inertia-patterns)
- [ ] Rewrite landing page — full rebrand: copy, brand, layout (not a patch)
- [ ] Rewrite auth pages (login, register) — brand + copy
- [ ] Rewrite app shell: header, nav, footer, profile page
- [ ] Dark mode — verify palette end-to-end: no hardcoded colors, no broken contrast, no visual errors
- [ ] Sweep every page for leftover "Nara"/"NARA" text and wrong branding

## Phase 5: Production readiness
- [ ] `npm run build` — production build passes
- [ ] Verify production env (`.env.production.example`) and config

## Phase 6: Finish
- [ ] README — project-specific setup and feature docs
- [ ] `npm run check` — full suite green
- [ ] Initial commit
```

### 6. Hand off — stop

Deliver both files and report: PRD approved, TODO complete. Execution is a separate step (user or another agent run) — do NOT start it yourself.

## Rename inventory (reference for the TODO)

Never trust a hardcoded list — re-run `grep -ri "nara"` during research and verify EVERY hit. Known locations:

| Where | What |
|---|---|
| `package.json` | name, description |
| `resources/inertia.html` | `<title>NARA - ...`, favicon `/public/nara.png` |
| `resources/Components/NaraIcon.svelte` | brand icon (rename file + all imports + alt text) |
| `resources/Components/Header.svelte` | brand text (desktop + mobile menu) |
| `resources/Pages/landing.svelte` | brand text, hero copy, footer |
| `resources/Pages/auth/login.svelte`, `register.svelte` | brand text, © footer |
| `resources/Pages/profile.svelte` | "Nara's backend" copy |
| `public/nara.png` | logo asset (replace or rename + update refs) |
| `README.md` | title, badges, links |
| `AGENTS.md` + nested AGENTS.md | name references; renaming a listed file → update its Structure table (check:agents) |
| `database/*.sqlite3` + `.env` | db file paths |

Rules:

- Search case-insensitively; rename file contents AND file names.
- If a file was renamed, update every import/reference (use LSP rename where available).
- Fresh db files regenerate on `migrate` — deleting `database/dev.sqlite3` is safe when the name changes.
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
- **Do** write the PRD comprehensive — every page, flow, edge case, and acceptance criterion; gaps are bugs.
- **Do** gate the TODO on explicit PRD approval — no approval, no TODO.
- **Do** make the TODO cover every rename inventory item and every PRD feature — completeness is the job.
- **Do** ask the user whenever confidence is below 95/100 — PRD content, branding, UI direction, anything unclear.
- **Do** commit `.nara/` — planning travels with the repo.
- **Don't** execute anything — no rename, no git reset, no code. New World writes PRD + TODO only.
- **Don't** guess or invent specs — the 95% confidence rule applies to everything in `.nara/`.
- **Don't** skip rename items in the TODO — title, env, AGENTS.md and friends are part of the plan.
- **Don't** write the TODO before PRD approval.
