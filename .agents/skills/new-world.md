---
trigger: Creating a new project from the Nara starter — copy the repo, write .nara/PRD.md + TODO.md, rename all "Nara" identity, then build via existing skills
---

# New World: Bootstrap a New Project from Nara

## When to use

Starting a NEW project built on top of this starter kit (copied via clone/fork/template). The starter must be rebranded before feature work. This skill drives the whole bootstrap: identity → planning docs → rename → verification → execution.

Ask the user FIRST — project name, vision, and any branding changes (title, logo). Never invent the project identity. Confirm the git reset before running it: it permanently deletes the starter's history.

## Pattern

### 1. Ask the user, then reset git

Ask FIRST — never invent the project identity:

- Project name (title / brand — drives `package.json`, `<title>`, headers, README)
- Vision: one line on what the project does
- Optional: new git remote URL

Then reset the starter's git history (confirm with the user first — this is destructive):

```bash
rm -rf .git && git init
```

- Add the new remote if provided: `git remote add origin <url>`
- `npm install`
- Do not build features before the rename is done and gates are green.

### 2. Create `.nara/PRD.md`

`.nara/` is project planning — COMMIT it, never gitignore it (same class as `docs/decisions/`).

```markdown
# <Project Name> — PRD

## Vision
One paragraph: what this project is and why it exists.

## Audience
Who uses it.

## Features (in scope)
- Feature A — acceptance: <observable result>
- Feature B — acceptance: <observable result>

## Non-goals
- Explicitly out of scope for v1.

## Acceptance criteria
- App runs with `npm run dev` under the new name.
- `npm run check` passes.
```

### 3. Create `.nara/TODO.md`

Execution checklist mapped to existing skills. Every item names the skill to load — the skill is the *how*, TODO is the *order*.

```markdown
# <Project Name> — TODO

## Phase 1: Foundation
- [ ] Rebrand: run rename checklist (skill: new-world)
- [ ] `npm run codemap && npm run check` — all gates green

## Phase 2: Auth & roles (skill: auth-rbac)
- [ ] Configure initial roles/permissions + seeders

## Phase 3: Resources (skill: crud-pattern — one cycle per resource)
- [ ] Resource <name> — `npm run gen:resource <name> -- --fields="..."`
- [ ] Resource <name> page polish (skill: inertia-patterns)

## Phase 4: Finish
- [ ] `npm run check` — full suite green
- [ ] Initial commit
```

### 4. Rename checklist

Never trust a hardcoded list — run `grep -ri "nara"` (case-insensitive: `nara`, `Nara`, `NARA`) across the repo and verify EVERY hit. Known locations:

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
| `CODEMAP.md` | regenerate — stale CODEMAP blocks CI (check:freshness) |

Rules:

- Search case-insensitively; rename file contents AND file names.
- If a file was renamed, update every import/reference (use LSP rename where available).
- Fresh db files regenerate on `migrate` — deleting `database/dev.sqlite3` is safe when the name changes.
- After the last hit: `npm run codemap`, then `npm run check`.

### 5. Execute the TODO

For each resource: `npm run gen:resource <name> -- --fields="..."`, then load `crud-pattern` to customize. Never hand-write the 10-file stack. Load `sqlite-usage` for non-trivial queries, `auth-rbac` for guards/permissions, `inertia-patterns` for pages, `testing-pattern` for tests.

## Examples

Start the rename with one command:

```bash
grep -ril "nara" . --exclude-dir=node_modules --exclude-dir=.git
```

Then edit each hit (see table above for what each file needs).

## Do / Don't

- **Do** ask the user for project name, vision, and branding BEFORE anything else — including before the git reset.
- **Do** commit `.nara/` — planning travels with the repo.
- **Do** keep TODO items mapped to existing skills — never duplicate crud/auth rules here.
- **Do** use `npm run gen:resource` for every new resource.
- **Do** grep for every "Nara" hit — the known-locations table goes stale.
- **Do** run `npm run codemap` after rename — `check:freshness` blocks CI on stale CODEMAP.
- **Don't** carry starter git history — `rm -rf .git && git init` after user confirmation.
- **Don't** start features before the rename is done and gates are green.
- **Don't** leave "Nara"/"NARA" in user-visible text: title, brand, README, landing copy.
- **Don't** modify existing migrations — create new ones.
