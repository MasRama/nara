# Frontend Overhaul: Custom Tailwind → shadcn-svelte

## TL;DR

> **Quick Summary**: Migrate Nara's Svelte 5 + Inertia.js frontend from hand-rolled Tailwind components to shadcn-svelte primitives. Preserve emerald `primary` brand color via CSS-variable bridging. Zero backend changes. Moderate visual refresh.
>
> **Deliverables**:
> - shadcn-svelte fully installed and configured for the Vite + Inertia (non-SvelteKit) layout
> - `--primary` CSS variable bridged to emerald-600 HSL; `bg-primary-500` utilities still work
> - 8 pages rebuilt with shadcn primitives (dashboard, landing, profile, users, 4× auth)
> - 7 components rebuilt (Header, UserModal, Pagination, DarkModeToggle, Can, NaraIcon, helper.ts)
> - `helper.ts` refactored and split into `resources/js/lib/*` (utils, api, csrf, toast, hooks)
> - `DarkModeToggle` replaced with `mode-watcher` integration
> - Sonner toaster wired into Inertia app entry
> - Vitest unit tests for all split lib/* modules
> - All CRUD flows (Auth, Users, Profile, Avatar upload) functional with identical endpoints/payloads
>
> **Estimated Effort**: Large (31 tasks across 4 waves + final verification)
> **Parallel Execution**: YES — 4 waves, max 7 concurrent
> **Critical Path**: T1 → T4 → T5 → T9 → T24 → T25 → F1-F4 → user okay

---

## Context

### Original Request (verbatim)
> "aku ingin dari nara ini bisa nggak frontend nya kamu rombak overhaul ke shadcn-svelte? untuk tampilan nya aku serahkan kepada kamu misal mau di overhaul agar cocok. yang pasti harus tetap ada warna primary yang dipakai dari config tailwind, (untuk kemudahan) lalu juga secara fungsionalitas harus aman ya (CRUD dll)"

### Interview Summary

**User-Confirmed Decisions**:
- Color strategy: **Bridge CSS var** — map `--primary` to emerald-600 HSL so shadcn components render in brand color automatically
- Redesign scope: **Moderate refresh** — swap primitives, consolidate visual language, keep page-level layouts
- Dark mode: **Adopt mode-watcher** (shadcn-recommended) — replaces DarkModeToggle localStorage logic
- Tailwind version: **Stay v3.4** — no v4 upgrade
- Testing: **Vitest unit tests only** — NO Playwright, NO browser automation; UI verified via `npm run build` + `tsc --noEmit` + curl + grep
- helper.ts: **Full refactor** — split into `lib/*` modules, update all imports
- Backend: **ZERO changes**

### Research Findings

- **shadcn-svelte@latest** supports Svelte 5 runes natively (bits-ui 1.0, @lucide/svelte 0.482+)
- CLI configurable via `components.json` with custom aliases pointing to `resources/js/lib`
- Required deps: `bits-ui`, `@lucide/svelte`, `tailwind-variants`, `mode-watcher`, `clsx`, `tailwind-merge`
- `resources/js/lib/components/ui/` already has empty subdirs matching shadcn component set — prior intent confirmed
- Backend HTTP contract mapped (all endpoints frozen):
  - Auth: `POST /login`, `POST /register`, `POST /logout`, `POST /change-password`
  - Profile: `POST /change-profile`, `POST /assets/avatar`
  - Users CRUD: `POST /users`, `PUT /users/:id`, `DELETE /users {ids:[]}`
  - Inertia pages: `/login`, `/register`, `/dashboard`, `/users`, `/profile`, `/forgot-password`, `/reset-password`, `/` (landing)
- Current frontend: 8 pages + 7 components + helper.ts (309 LOC utility) + app.js entry

### Self-Review Gap Analysis (Metis unavailable for plan-family)

**Critical risks identified and addressed in plan:**

1. **Tailwind primary collision**: shadcn expects `colors.primary = hsl(var(--primary))` but project has `primary: {50..950}` object. **Solution**: Add `DEFAULT` and `foreground` keys to the object (non-destructive). `bg-primary` → emerald via var; `bg-primary-500` → literal hex. Both work.
2. **Migration atomicity**: Rebuilding pages one-by-one could leave mixed old/new imports. **Solution**: Keep `Components/helper.ts` as a re-export shim during Wave 3; remove only in Wave 4 after all page migrations verified.
3. **Inertia hydration + Dialog portals**: shadcn Dialog uses fixed-position portal; Inertia SSR may mismatch. **Solution**: Mount Toaster and Dialog portals at app root via app.js resolve callback. Tested in T14.
4. **Sonner replacement of custom Toast**: helper.ts has custom `Toast()` function used across pages. **Solution**: `lib/toast.ts` exports identical `Toast(type, message)` signature delegating to sonner, so existing page code keeps working. Unit test verifies signature preservation.
5. **Semantic colors mapping**: shadcn expects `--destructive`, `--muted`, `--accent`, `--border`, `--ring`. **Solution**: Map `--destructive` → danger-600 HSL, `--accent` → accent-600 HSL, `--ring` → emerald-500 HSL (focus ring matches brand). Full semantic var sheet in T5.
6. **Component tests risk**: Svelte 5 component unit testing requires @testing-library/svelte + jsdom. **Solution**: Unit tests target `lib/*` utility modules only (pure logic: cn, csrf, toast wrapper, api). UI verification via `npm run build` + `tsc --noEmit` + curl + grep — no component render tests needed.
7. **Backward compat during rollout**: Some tasks modify shared files (app.js, index.css). **Solution**: Wave 1 foundations are atomic and MUST all succeed before Wave 2 starts (no partial Wave 1). Sequence enforces this.

---

## Work Objectives

### Core Objective
Replace hand-rolled Tailwind UI primitives with shadcn-svelte components across the entire Nara frontend, preserving the emerald `primary` brand color and all CRUD functionality, while consolidating visual language to a clean shadcn-style moderate refresh.

### Concrete Deliverables
1. `components.json` in project root (shadcn CLI config with custom aliases)
2. Updated `vite.config.ts` + `tsconfig.json` (`$lib` alias → `resources/js/lib`)
3. Updated `tailwind.config.js` (primary object + semantic tokens, non-destructive)
4. Updated `resources/js/index.css` (@layer base with shadcn CSS variables bridged to emerald HSL)
5. `resources/js/lib/utils.ts` with `cn()` helper (standard shadcn)
6. `resources/js/lib/` modules: `api.ts`, `csrf.ts`, `toast.ts`, `hooks/click-outside.ts`, `utils/password.ts`, `utils/debounce.ts`
7. 20 shadcn-svelte components populated in `resources/js/lib/components/ui/` (button, card, input, label, textarea, badge, alert, avatar, separator, skeleton, dialog, sheet, dropdown-menu, tabs, select, checkbox, switch, table, pagination, sonner)
8. Rebuilt pages (8): `Pages/dashboard.svelte`, `Pages/landing.svelte`, `Pages/profile.svelte`, `Pages/users.svelte`, `Pages/auth/login.svelte`, `Pages/auth/register.svelte`, `Pages/auth/forgot-password.svelte`, `Pages/auth/reset-password.svelte`
9. Rebuilt components: `Components/Header.svelte`, `Components/UserModal.svelte`, `Components/Pagination.svelte`, `Components/DarkModeToggle.svelte`
10. Preserved-as-is components: `Components/Can.svelte`, `Components/NaraIcon.svelte`
11. Updated `resources/js/app.js` (or `.ts`) — Toaster + ModeWatcher wrapping
12. Vitest unit tests for `lib/api.ts`, `lib/csrf.ts`, `lib/toast.ts`, `lib/utils/password.ts`, `lib/utils/debounce.ts`, `lib/utils.ts`

### Definition of Done
- [ ] `npm run build` → exits 0
- [ ] `npx tsc --noEmit` → exits 0 (zero errors)
- [ ] `npm test` (Vitest) → all tests PASS
- [ ] `node nara lint` → exits 0
- [ ] `grep -r "Components/helper" resources/js` → no matches (old path gone)
- [ ] `grep -rE "from ['\"]\\\$lib" resources/js | wc -l` → ≥ 15 (new lib/* imports in use)
- [ ] Dev server start: `npm run dev` → server reachable on :5555 and :5173
- [ ] `curl -s http://localhost:5555/login` → HTML contains Inertia page payload
- [ ] `curl -sI http://localhost:5555/dashboard` → 302 to /login (auth works)
- [ ] After login, `curl -s -b cookies.txt http://localhost:5555/users` → page renders shadcn components (grep for `data-slot` attribute used by shadcn)
- [ ] `grep -r "bg-primary-500" resources/js | wc -l` → > 0 (utility classes preserved)
- [ ] `grep -rE "class=.*(btn-primary|btn-secondary|nav-link)" resources/js` → no matches (dead utility classes removed)

### Must Have
- shadcn-svelte installed and CLI reproducible (`npx shadcn-svelte add <component>` works in this repo)
- `components.json` valid and points to `resources/js/lib`
- `--primary` CSS var resolves to emerald-600 HSL (`160 84% 39%` approximately; verify exact via conversion in T5)
- Primary token available BOTH ways: `bg-primary` (via HSL var) AND `bg-primary-500` (via existing scale) functional
- All 8 Inertia pages navigable without runtime errors
- All CRUD flows intact: login, register, logout, password change, profile update, avatar upload, user create/update/delete (bulk)
- Sonner `<Toaster />` mounted globally; `Toast()` wrapper preserves old API signature
- Dark mode toggles correctly; persists in localStorage; respects system preference
- `<Can />` authorization wrapper continues to work unchanged
- CSRF headers via `buildCSRFHeaders()` (now in `lib/csrf.ts`) still attached to mutations
- Inertia `router.visit()` navigation preserved across all pages
- All Svelte 5 runes patterns preserved (`$props`, `$state`, `$derived`)
- Vitest suite for `lib/*` modules exists and passes

### Must NOT Have (Guardrails)

**Scope lock-down:**
- NO backend modifications (`app/controllers/`, `app/models/`, `routes/`, `migrations/`, `app/services/` all untouched)
- NO changes to route URLs or HTTP method/payload contracts
- NO Tailwind v4 upgrade (stay on v3.4.x)
- NO Playwright, @playwright/test, or any browser automation dependency installed
- NO new pages invented beyond the 8 existing (dashboard, landing, profile, users, auth/{login, register, forgot-password, reset-password})
- NO removal of `primary-*` color scale (50..950 must stay in tailwind.config.js)
- NO removal of `accent`, `warning`, `danger`, `info`, `success`, `surface` color palettes
- NO replacement of Inertia.js, Svelte 5, or HyperExpress

**Code-quality guardrails:**
- NO two copies of helper.ts (must either shim-re-export OR fully remove by Wave 4)
- NO dead `@layer components` CSS utility classes left in `index.css` after Wave 4 (`.btn-primary`, `.btn-secondary`, `.nav-link`, `.gradient-text`, `.card-hover`, `.mobile-nav-link`, `.btn-accent`, `.btn-danger`, `.btn-warning`, `.btn-info` — remove if no remaining usage)
- NO `as any` / `@ts-ignore` / `@ts-nocheck` introduced
- NO commented-out blocks of legacy code left behind
- NO `console.log` in production code paths (test files exempt)
- NO orphaned files (if we move helper.ts, old one must be deleted, not kept alongside)

**Visual guardrails (Moderate refresh, not redesign):**
- NO new route-level navigation patterns (e.g., don't introduce collapsible sidebar if current is topbar)
- NO redesigned user-facing copy / language strings
- NO new marketing sections on landing page beyond what exists
- NO logo replacement — `NaraIcon.svelte` stays pointing to same asset

---

## Verification Strategy

> **ZERO HUMAN INTERVENTION**. ALL verification is agent-executed via Vitest, build commands, curl, and grep.

### Test Decision
- **Infrastructure exists**: YES (Vitest already in devDeps, `npm test` script present)
- **Automated tests**: YES (tests-after, scoped to `lib/*` utility modules)
- **Framework**: `vitest` (already in devDependencies)
- **TDD**: NO (tests written after implementation for each `lib/*` module in same task)
- **UI tests**: NO unit/component tests for `.svelte` files. UI verified via build + tsc + curl + grep.

### QA Policy
Every task includes agent-executed QA scenarios. Evidence saved to `.sisyphus/evidence/task-{N}-{scenario-slug}.{ext}`.

**Tool matrix:**
- **Library/utility code** (`lib/api.ts`, `lib/csrf.ts`, `lib/toast.ts`, `lib/utils/*`): Vitest unit tests
- **TypeScript correctness** (all files): `npx tsc --noEmit` output captured
- **Build integrity** (all files): `npm run build` output captured
- **UI rendering** (pages, components): `curl` against dev server, grep response HTML for expected shadcn markers (`data-slot`, `data-melt`, specific class prefixes) + presence of critical text
- **CRUD flow**: `curl` POST/PUT/DELETE with auth cookies; assert JSON response status + shape
- **Dark mode**: `curl` + grep `.dark` class toggle via injected JS snippet
- **Static check** (imports, dead code): `grep -r` patterns with `wc -l` assertions

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Foundation, MAX parallel — starts immediately):
├── T1: Install shadcn-svelte dependencies [quick]
├── T2: Create components.json with custom aliases [quick]
├── T3: Add $lib alias to vite + tsconfig paths [quick]
├── T4: Augment tailwind.config.js with DEFAULT keys + semantic tokens [quick]
├── T5: Update index.css @layer base CSS vars (bridged to emerald HSL) [quick]
├── T6: Create lib/utils.ts with cn() helper [quick]
├── T7: Split helper.ts → lib/api.ts, lib/csrf.ts, lib/toast.ts, lib/hooks/, lib/utils/* (with re-export shim) [unspecified-high]
└── T8: Vitest unit tests for split lib/* modules [unspecified-high]

Wave 2 (Primitive installation + shared components — parallel, after Wave 1):
├── T9:  Install shadcn primitives batch 1: button, card, input, label, textarea [quick]
├── T10: Install shadcn primitives batch 2: badge, alert, avatar, separator, skeleton [quick]
├── T11: Install shadcn primitives batch 3: dialog, sheet, dropdown-menu, tabs [quick]
├── T12: Install shadcn primitives batch 4: select, checkbox, switch [quick]
├── T13: Install shadcn primitives batch 5: table, pagination, sonner [quick]
├── T14: Wire <Toaster /> + <ModeWatcher /> into app.js [quick]
├── T15: Rebuild DarkModeToggle.svelte using mode-watcher [quick]
├── T16: Rebuild Components/Pagination.svelte using shadcn Pagination [quick]
└── T17: Verify Can.svelte and NaraIcon.svelte compatibility (no changes expected) [quick]

Wave 3 (Page rebuilds — parallel, after Wave 2):
├── T18: Rebuild auth/login.svelte [visual-engineering]
├── T19: Rebuild auth/register.svelte [visual-engineering]
├── T20: Rebuild auth/forgot-password.svelte [visual-engineering]
├── T21: Rebuild auth/reset-password.svelte [visual-engineering]
├── T22: Rebuild Components/Header.svelte with NavigationMenu/Sheet/DropdownMenu [visual-engineering]
├── T23: Rebuild Components/UserModal.svelte with shadcn Dialog + form primitives [visual-engineering]
├── T24: Rebuild Pages/users.svelte (depends T16, T22, T23) [visual-engineering]
├── T25: Rebuild Pages/profile.svelte (depends T22) [visual-engineering]
├── T26: Rebuild Pages/dashboard.svelte (depends T22) [visual-engineering]
└── T27: Rebuild Pages/landing.svelte (moderate refresh, depends T22) [visual-engineering]

Wave 4 (Cleanup + integration):
├── T28: Remove Components/helper.ts shim; migrate remaining imports to $lib/* [unspecified-high]
├── T29: Purge dead @layer components rules from index.css [quick]
├── T30: Full green check — build + tsc + vitest + lint [quick]
└── T31: Commit strategy execution (atomic commits per logical group) [git]

Wave FINAL (Review — 4 parallel agents, then user okay):
├── F1: Plan compliance audit [oracle]
├── F2: Code quality review [unspecified-high]
├── F3: Real manual QA (curl + grep + build/test scenarios) [unspecified-high]
└── F4: Scope fidelity check [deep]
→ Present results → Get explicit user "okay"

Critical Path: T1 → T4 → T5 → T9 → T23 → T24 → T30 → F1-F4 → user okay
Parallel Speedup: ~70% vs sequential
Max Concurrent: 10 (Wave 3)
```

### Dependency Matrix

| Task | Depends On | Blocks | Wave |
|------|------------|--------|------|
| T1   | — | T9-T14 | 1 |
| T2   | — | T9-T13 | 1 |
| T3   | — | All file refs using $lib | 1 |
| T4   | — | T9-T13 | 1 |
| T5   | T4 | T9-T13 | 1 |
| T6   | T3 | T15-T27 (cn usage) | 1 |
| T7   | T3, T6 | T14, T15, T23, T24, T25, T26, T28 | 1 |
| T8   | T7 | — | 1 |
| T9   | T1, T2, T3, T4, T5 | T18-T27 (Input, Button, Card) | 2 |
| T10  | T1, T2, T3, T4, T5 | T24, T25, T26 (Badge, Avatar, Alert) | 2 |
| T11  | T1, T2, T3, T4, T5 | T22, T23 (Dialog, Sheet, DropdownMenu) | 2 |
| T12  | T1, T2, T3, T4, T5 | T23, T24 (Switch, Checkbox) | 2 |
| T13  | T1, T2, T3, T4, T5 | T14, T16, T24 (Pagination, Sonner) | 2 |
| T14  | T13, T7 | T18-T27 (Toast wiring) | 2 |
| T15  | T1, T7 | T22 (Header uses DarkModeToggle) | 2 |
| T16  | T13 | T24 (users.svelte pagination) | 2 |
| T17  | T3 | — | 2 |
| T18  | T9, T10, T14 | — | 3 |
| T19  | T9, T10, T14 | — | 3 |
| T20  | T9, T10, T14 | — | 3 |
| T21  | T9, T14 | — | 3 |
| T22  | T11, T15, T7 | T24, T25, T26, T27 | 3 |
| T23  | T9, T11, T12, T14 | T24 | 3 |
| T24  | T9-T13, T16, T22, T23, T14 | T28 | 3 |
| T25  | T9, T10, T14, T22 | T28 | 3 |
| T26  | T9, T10, T14, T22 | T28 | 3 |
| T27  | T9, T10, T14, T22 | T28 | 3 |
| T28  | T18-T27 | T30 | 4 |
| T29  | T18-T27 | T30 | 4 |
| T30  | T28, T29 | T31 | 4 |
| T31  | T30 | F1-F4 | 4 |

### Agent Dispatch Summary

| Wave | Tasks | Agent Dispatch |
|------|-------|----------------|
| 1 | 8 | T1-T6 → `quick`; T7, T8 → `unspecified-high` |
| 2 | 9 | T9-T14 → `quick`; T15-T17 → `quick` |
| 3 | 10 | T18-T27 → `visual-engineering` |
| 4 | 4 | T28 → `unspecified-high`; T29, T30 → `quick`; T31 → `quick` |
| FINAL | 4 | F1 → `oracle`; F2, F3 → `unspecified-high`; F4 → `deep` |

---

## TODOs

- [ ] 1. Install shadcn-svelte dependencies

  **What to do**:
  - Run: `npm install bits-ui @lucide/svelte tailwind-variants mode-watcher clsx tailwind-merge`
  - Run: `npm install -D @types/node` (if not already present)
  - Verify `package.json` updated with exact versions
  - Do NOT install `shadcn-svelte` as a dep; it's CLI-only via npx

  **Must NOT do**:
  - Do NOT install `@playwright/test` or any browser automation
  - Do NOT install `@testing-library/svelte` (user said no component tests)
  - Do NOT downgrade or upgrade existing deps (svelte, @inertiajs/svelte, tailwindcss)
  - Do NOT remove any existing dependencies

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Pure npm install. Deterministic, no design decisions.
  - **Skills**: []
    - No skills needed — straightforward dependency install

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with T2-T8)
  - **Blocks**: T9-T14 (shadcn CLI needs deps present)
  - **Blocked By**: None (can start immediately)

  **References**:
  - `package.json:36-72` — Current dependency list (add new deps to dependencies, not devDependencies since they're runtime UI libs)
  - Research: "Required dependencies: bits-ui ^1.0.0, @lucide/svelte ^0.482.0, tailwind-variants latest, mode-watcher ^1.0.0, clsx, tailwind-merge"

  **Acceptance Criteria**:
  - [ ] `grep -E '"bits-ui"|"@lucide/svelte"|"tailwind-variants"|"mode-watcher"|"clsx"|"tailwind-merge"' package.json | wc -l` → 6
  - [ ] `npm ls bits-ui @lucide/svelte tailwind-variants mode-watcher clsx tailwind-merge` → no UNMET DEPENDENCY errors
  - [ ] `npx tsc --noEmit` → exit 0 (existing code still compiles)
  - [ ] `grep -E '"@playwright/test"|"playwright"' package.json` → no matches

  **QA Scenarios**:
  ```
  Scenario: All required deps installed
    Tool: Bash
    Preconditions: package.json has 6 new deps added
    Steps:
      1. Run: npm ls bits-ui @lucide/svelte tailwind-variants mode-watcher clsx tailwind-merge > .sisyphus/evidence/task-1-deps-list.txt 2>&1
      2. Assert file size > 0 and no "UNMET" string in output
      3. Run: grep -c "UNMET" .sisyphus/evidence/task-1-deps-list.txt
    Expected Result: exit 0, grep count = 0
    Failure Indicators: "UNMET DEPENDENCY" in output, or missing package
    Evidence: .sisyphus/evidence/task-1-deps-list.txt

  Scenario: No forbidden deps introduced
    Tool: Bash
    Preconditions: npm install completed
    Steps:
      1. Run: npm ls @playwright/test playwright 2>&1 | tee .sisyphus/evidence/task-1-no-playwright.txt
      2. Assert output contains "empty" or "not installed" (not "installed")
    Expected Result: Playwright NOT in dep tree
    Evidence: .sisyphus/evidence/task-1-no-playwright.txt
  ```

  **Commit**: NO (groups with T2-T6 into single config commit in T31)

- [ ] 2. Create components.json with custom aliases for resources/js/lib

  **What to do**:
  - Create `components.json` at project root with this content:
    ```json
    {
      "$schema": "https://shadcn-svelte.com/schema.json",
      "style": "default",
      "tailwind": {
        "config": "tailwind.config.js",
        "css": "resources/js/index.css",
        "baseColor": "slate",
        "cssVariables": true
      },
      "aliases": {
        "components": "$lib/components",
        "utils": "$lib/utils",
        "ui": "$lib/components/ui",
        "hooks": "$lib/hooks"
      },
      "typescript": true,
      "registry": "https://shadcn-svelte.com/registry"
    }
    ```
  - Verify the JSON is valid
  - Verify file paths (`resources/js/index.css`, `tailwind.config.js`) exist

  **Must NOT do**:
  - Do NOT change `baseColor` from `slate` (we'll bridge --primary separately to emerald; baseColor is shadcn's neutral palette)
  - Do NOT set `aliases.components` to `src/lib/*` (this is NOT SvelteKit)
  - Do NOT commit with invalid JSON

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Single file creation, strict structure, no design decisions
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with T1, T3-T8)
  - **Blocks**: T9-T13 (shadcn CLI reads this file)
  - **Blocked By**: None

  **References**:
  - Research output: "authoritative components.json structure for non-SvelteKit"
  - `resources/js/lib/components/ui/` (already exists with empty subdirs — confirms this path)
  - `resources/js/index.css` (confirmed to exist at line 1 — this is the CSS shadcn will inject vars into)

  **Acceptance Criteria**:
  - [ ] File `components.json` exists at project root
  - [ ] `node -e "JSON.parse(require('fs').readFileSync('components.json'))"` → exit 0 (valid JSON)
  - [ ] `grep '"ui": "\\$lib/components/ui"' components.json` → 1 match
  - [ ] `grep '"typescript": true' components.json` → 1 match

  **QA Scenarios**:
  ```
  Scenario: components.json is valid and points to resources/js/lib
    Tool: Bash
    Preconditions: components.json created
    Steps:
      1. Run: node -e "const c = JSON.parse(require('fs').readFileSync('components.json','utf8')); console.log(JSON.stringify(c.aliases))" > .sisyphus/evidence/task-2-aliases.txt
      2. Assert file contains "$lib/components/ui" and "$lib/utils"
    Expected Result: aliases object correctly maps to $lib/*
    Evidence: .sisyphus/evidence/task-2-aliases.txt

  Scenario: Referenced paths exist
    Tool: Bash
    Preconditions: components.json created
    Steps:
      1. Run: test -f resources/js/index.css && test -f tailwind.config.js && echo OK
    Expected Result: Output "OK"
    Evidence: inline shell exit code
  ```

  **Commit**: NO (groups with T1, T3-T6)

- [ ] 3. Add $lib alias to vite.config + tsconfig.json paths

  **What to do**:
  - Read current `vite.config.ts` (or `vite.config.js`) — find the `resolve.alias` block
  - Add: `"$lib": path.resolve("./resources/js/lib")` to the alias map
  - Read current `tsconfig.json` — find `compilerOptions.paths`
  - Add: `"$lib/*": ["./resources/js/lib/*"]` (keep all existing paths like `@core`, `@models` intact)
  - Verify `baseUrl` in tsconfig is `"."` (if not set, add it)

  **Must NOT do**:
  - Do NOT remove any existing aliases (`@core`, `@models`, `@services`, etc.)
  - Do NOT change `baseUrl` if already set to a different value
  - Do NOT convert the alias object to a different syntax

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Surgical edit of two config files, no logic
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1
  - **Blocks**: T6, T7, T17 (anything importing from $lib)
  - **Blocked By**: None

  **References**:
  - `vite.config.mjs` (verified: actual file at project root uses `.mjs` extension — edit this exact file)
  - `tsconfig.json` — existing `paths` block already includes `@/*`, `@core`, `@core/*`, `@controllers/*` (verified — preserve these exactly)
  - AGENTS.md: "Path aliases — Always use @core, @models, @services, etc." — preserve these exactly

  **Acceptance Criteria**:
  - [ ] `grep -E '"\\$lib"|\\$lib:' vite.config.mjs` → ≥ 1 match
  - [ ] `grep '"\\$lib/\\*"' tsconfig.json` → 1 match
  - [ ] `grep -E '"@core"|@core:' vite.config.mjs` → ≥ 1 match (existing alias preserved)
  - [ ] `grep '"@core/\\*"' tsconfig.json` → still matches
  - [ ] `npx tsc --noEmit` → exit 0

  **QA Scenarios**:
  ```
  Scenario: $lib alias configured in both config files
    Tool: Bash
    Preconditions: vite.config.mjs and tsconfig.json updated
    Steps:
      1. Run: grep -nE '\\$lib' vite.config.mjs tsconfig.json > .sisyphus/evidence/task-3-alias-config.txt
      2. Assert output contains BOTH files with $lib references (≥ 2 lines total)
      3. Run: node -e "const t = require('./tsconfig.json'); console.log(JSON.stringify(t.compilerOptions.paths))" > .sisyphus/evidence/task-3-tsconfig-paths.json
      4. Grep output for "$lib/*" — assert match
    Expected Result: $lib alias present in both vite + tsconfig
    Evidence: .sisyphus/evidence/task-3-alias-config.txt, .sisyphus/evidence/task-3-tsconfig-paths.json

  Scenario: Existing aliases preserved
    Tool: Bash
    Preconditions: vite.config.mjs and tsconfig updated
    Steps:
      1. Run: grep -c '@core' vite.config.mjs tsconfig.json > .sisyphus/evidence/task-3-existing-aliases.txt
      2. Assert each file has ≥ 1 match (total ≥ 2)
    Expected Result: @core alias preserved in both files
    Evidence: .sisyphus/evidence/task-3-existing-aliases.txt

  Scenario: TypeScript still compiles with new paths
    Tool: Bash
    Preconditions: T3 complete
    Steps:
      1. Run: npx tsc --noEmit 2>&1 | tee .sisyphus/evidence/task-3-tsc.txt
      2. Assert exit 0
    Expected Result: Type check passes (alias doesn't break anything)
    Evidence: .sisyphus/evidence/task-3-tsc.txt
  ```

  **Commit**: NO (groups with T1-T6)

- [ ] 4. Augment tailwind.config.js with DEFAULT keys + semantic tokens

  **What to do**:
  - Edit `tailwind.config.js` to add `DEFAULT` and `foreground` keys to the `primary` color object (NON-destructively: keep 50..950 intact)
  - Add new semantic color tokens needed by shadcn: `background`, `foreground`, `card`, `card-foreground`, `popover`, `popover-foreground`, `muted`, `muted-foreground`, `border`, `input`, `ring`, `destructive`, `destructive-foreground`
  - All new tokens reference CSS variables: `hsl(var(--primary))`, `hsl(var(--border))`, etc.
  - Add `borderRadius` extend block: `lg: var(--radius)`, `md: calc(var(--radius) - 2px)`, `sm: calc(var(--radius) - 4px)` (shadcn standard)
  - Preserve ALL existing colors (`secondary`, `accent`, `info`, `warning`, `danger`, `success`, `surface`)
  - Preserve `darkMode: 'class'`, `fontFamily`, `boxShadow`, `typography` plugin config

  **Example snippet to add under `theme.extend.colors`:**
  ```js
  primary: {
    DEFAULT: 'hsl(var(--primary))',
    foreground: 'hsl(var(--primary-foreground))',
    50: '#ecfdf5',
    // ... existing 100-950 stays
  },
  // NEW semantic tokens:
  background: 'hsl(var(--background))',
  foreground: 'hsl(var(--foreground))',
  card: { DEFAULT: 'hsl(var(--card))', foreground: 'hsl(var(--card-foreground))' },
  popover: { DEFAULT: 'hsl(var(--popover))', foreground: 'hsl(var(--popover-foreground))' },
  muted: { DEFAULT: 'hsl(var(--muted))', foreground: 'hsl(var(--muted-foreground))' },
  border: 'hsl(var(--border))',
  input: 'hsl(var(--input))',
  ring: 'hsl(var(--ring))',
  destructive: { DEFAULT: 'hsl(var(--destructive))', foreground: 'hsl(var(--destructive-foreground))' },
  ```

  **Must NOT do**:
  - Do NOT remove `secondary`, `accent`, `info`, `warning`, `danger`, `success`, `surface` scales
  - Do NOT remove `primary` 50..950 scale (add DEFAULT/foreground ALONGSIDE)
  - Do NOT change `darkMode` strategy
  - Do NOT remove `@tailwindcss/typography` plugin
  - Do NOT install additional Tailwind plugins beyond what's required
  - Do NOT convert to Tailwind v4 CSS-first syntax

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Config file edit with clear non-destructive additions
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1
  - **Blocks**: T5 (index.css must supply the --primary var T4 references), T9-T13 (shadcn components use these tokens)
  - **Blocked By**: None

  **References**:
  - `tailwind.config.js:13-120` — All existing color scales (preserve!)
  - `tailwind.config.js:6` — `darkMode: 'class'` (preserve)
  - `tailwind.config.js:15-27` — primary scale (emerald, 50..950) — must remain
  - shadcn-svelte default Tailwind config structure (from research output)
  - Research: "shadcn default token set: --primary, --destructive, --muted, --accent, --background, --foreground, --border, --input, --ring, --card, --popover"

  **Acceptance Criteria**:
  - [ ] `grep -A2 "primary: {" tailwind.config.js | grep -E "DEFAULT|50: '#ecfdf5'"` → both match (DEFAULT added, 50 preserved)
  - [ ] `grep -E "secondary:|accent:|info:|warning:|danger:|success:|surface:" tailwind.config.js | wc -l` → ≥ 7 (all palettes preserved)
  - [ ] `grep -E "border: 'hsl|ring: 'hsl|destructive:" tailwind.config.js | wc -l` → ≥ 3 (semantic tokens added)
  - [ ] `grep "darkMode: 'class'" tailwind.config.js` → 1 match
  - [ ] `grep "@tailwindcss/typography" tailwind.config.js` → 1 match

  **QA Scenarios**:
  ```
  Scenario: Existing color scales intact
    Tool: Bash
    Preconditions: tailwind.config.js edited
    Steps:
      1. Run: grep -cE "^\s+(primary|secondary|accent|info|warning|danger|success|surface):" tailwind.config.js > .sisyphus/evidence/task-4-palettes.txt
      2. Assert count ≥ 7
    Expected Result: All 7+ color palette objects preserved
    Evidence: .sisyphus/evidence/task-4-palettes.txt

  Scenario: Semantic tokens added for shadcn
    Tool: Bash
    Preconditions: tailwind.config.js edited
    Steps:
      1. Run: grep -oE "hsl\\(var\\(--(primary|border|ring|destructive|background|foreground|muted|card|popover|input))" tailwind.config.js | sort -u > .sisyphus/evidence/task-4-tokens.txt
      2. Count unique tokens — assert ≥ 10
    Expected Result: All essential shadcn semantic tokens present
    Evidence: .sisyphus/evidence/task-4-tokens.txt

  Scenario: Build config is valid JS
    Tool: Bash
    Preconditions: tailwind.config.js edited
    Steps:
      1. Run: node -e "require('./tailwind.config.js')" 2>&1 | tee .sisyphus/evidence/task-4-syntax.txt
      2. Assert no SyntaxError output
    Expected Result: Config loads without error
    Evidence: .sisyphus/evidence/task-4-syntax.txt
  ```

  **Commit**: NO (groups with T1-T6)

- [ ] 5. Update index.css @layer base with shadcn CSS variables (bridged to emerald HSL)

  **What to do**:
  - Edit `resources/js/index.css` — add an `@layer base { :root { ... } .dark { ... } }` block with shadcn CSS variables
  - Bridge `--primary` to emerald-600 HSL: approximately `160 84% 39%` (use online HSL converter or `node -e "console.log(require('color-convert').hex.hsl('059669'))"` — document exact value in comments)
  - Bridge `--primary-foreground` to white/near-white (emerald-50 HSL: `151 81% 96%`)
  - Bridge `--destructive` to danger-600 HSL (`#dc2626` → ~`0 72% 51%`)
  - Bridge `--accent` to accent-600 HSL (`#9333ea` → ~`271 81% 56%`)
  - Bridge `--ring` to emerald-500 HSL (`#10b981` → ~`160 84% 39%`)
  - Set light mode `--background`, `--foreground`, `--card`, `--popover`, `--muted`, `--border`, `--input` with slate/neutral HSL values per shadcn defaults
  - Set dark mode overrides under `.dark { ... }` (darker background, lighter foreground)
  - Set `--radius: 0.5rem`
  - KEEP existing `@layer base` html font-family and scrollbar styles
  - KEEP existing `@layer components` for now (`.btn-primary`, `.card`, `.nav-link`, etc.) — they'll be removed in T29 after page migrations

  **Reference conversion** (to document in comments):
  - emerald-600 `#059669` → HSL: `160.1 84.1% 39.4%`
  - emerald-500 `#10b981` → HSL: `160.1 84.1% 39.4%` (close enough, use for --ring)
  - danger-600 `#dc2626` → HSL: `0 72.2% 50.6%`
  - accent-600 `#9333ea` → HSL: `271.5 81.3% 55.9%`

  **Must NOT do**:
  - Do NOT remove existing `@layer components` classes (T29 handles cleanup AFTER migrations)
  - Do NOT remove `@import url('https://rsms.me/inter/inter.css');` or Playfair font imports
  - Do NOT remove existing `html`, `body::-webkit-scrollbar` rules
  - Do NOT bridge `--primary` to any color OTHER than emerald (user's hard requirement)
  - Do NOT use `rgb()` or `oklch()` — shadcn expects HSL triplet space-separated values without commas

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Single CSS file edit with clear token mapping
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: NO — must run after T4 (tailwind.config.js must have token references first)
  - **Parallel Group**: Sequential after T4
  - **Blocks**: T9-T13 (shadcn components read these vars)
  - **Blocked By**: T4

  **References**:
  - `resources/js/index.css:1-6` — existing imports + @tailwind directives (preserve)
  - `resources/js/index.css:7-24` — existing `@layer base` html/scrollbar (preserve and extend)
  - `resources/js/index.css:26-136` — existing `@layer components` (preserve temporarily, T29 removes)
  - `tailwind.config.js:15-27` — emerald primary scale (source of HSL values for --primary)
  - `tailwind.config.js:85-97` — danger scale (for --destructive)
  - Research: "shadcn expects HSL triplets as space-separated values, e.g. `142.1 70.6% 45.3%`"

  **Acceptance Criteria**:
  - [ ] `grep -c ":root {" resources/js/index.css` → ≥ 1
  - [ ] `grep "--primary:" resources/js/index.css` → matches line with "160" (emerald HSL)
  - [ ] `grep "--destructive:" resources/js/index.css` → matches with "0 72"
  - [ ] `grep "--radius: 0.5rem" resources/js/index.css` → 1 match
  - [ ] `grep "\\.dark {" resources/js/index.css` → ≥ 1 match
  - [ ] `grep "btn-primary" resources/js/index.css` → still matches (not removed yet)
  - [ ] `npm run build` → exit 0

  **QA Scenarios**:
  ```
  Scenario: CSS variables defined for both modes
    Tool: Bash
    Preconditions: index.css edited
    Steps:
      1. Run: grep -cE "--primary:|--destructive:|--ring:|--background:|--foreground:|--border:|--muted:|--accent:" resources/js/index.css > .sisyphus/evidence/task-5-vars.txt
      2. Assert count ≥ 16 (8 vars × 2 modes = 16 definitions)
    Expected Result: All semantic tokens defined in both :root and .dark
    Evidence: .sisyphus/evidence/task-5-vars.txt

  Scenario: Primary color is emerald
    Tool: Bash
    Preconditions: index.css edited
    Steps:
      1. Run: grep "--primary:" resources/js/index.css | tee .sisyphus/evidence/task-5-primary-color.txt
      2. Assert each line contains HSL triplet starting with "160" (emerald hue) or "142" (close-enough)
    Expected Result: --primary resolves to emerald HSL
    Evidence: .sisyphus/evidence/task-5-primary-color.txt

  Scenario: Tailwind build resolves variables
    Tool: Bash
    Preconditions: tailwind.config.js (T4) + index.css (T5) updated
    Steps:
      1. Run: npm run build 2>&1 | tee .sisyphus/evidence/task-5-build.txt | tail -20
      2. Assert exit 0 and no "Cannot resolve" errors
    Expected Result: Build succeeds; CSS tokens resolve at compile time
    Evidence: .sisyphus/evidence/task-5-build.txt
  ```

  **Commit**: NO (groups with T1-T6)

- [ ] 6. Create lib/utils.ts with cn() helper

  **What to do**:
  - Create `resources/js/lib/utils.ts` with the standard shadcn `cn()` helper:
    ```ts
    import { type ClassValue, clsx } from "clsx";
    import { twMerge } from "tailwind-merge";

    export function cn(...inputs: ClassValue[]) {
      return twMerge(clsx(inputs));
    }
    ```
  - This is the canonical shadcn utility used by all component templates

  **Must NOT do**:
  - Do NOT re-export anything else from utils.ts (keep it focused — other utilities go in `lib/utils/` subdirectory in T7)
  - Do NOT add TypeScript `as any`
  - Do NOT use default export (shadcn uses named export)

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Single-file, single-function creation, standard shadcn pattern
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: NO — needs T3 (for $lib alias) before it can be validated
  - **Parallel Group**: Sequential after T3
  - **Blocks**: T7, T15-T27 (all shadcn-consuming code uses cn())
  - **Blocked By**: T3

  **References**:
  - Research output: "cn() helper standard shadcn" with clsx + tailwind-merge
  - `resources/js/lib/` directory exists (verified in initial scan — has empty subdirs)

  **Acceptance Criteria**:
  - [ ] File `resources/js/lib/utils.ts` exists
  - [ ] `grep "export function cn" resources/js/lib/utils.ts` → 1 match
  - [ ] `grep "twMerge" resources/js/lib/utils.ts` → 1 match
  - [ ] `grep "clsx" resources/js/lib/utils.ts` → ≥ 1 match
  - [ ] `npx tsc --noEmit` → exit 0 (imports resolve)

  **QA Scenarios**:
  ```
  Scenario: cn() file structure and imports resolve
    Tool: Bash
    Preconditions: utils.ts created, deps from T1 installed
    Steps:
      1. Run: grep -E "^import|^export function cn" resources/js/lib/utils.ts > .sisyphus/evidence/task-6-structure.txt
      2. Assert 2 import lines (clsx, tailwind-merge) and 1 export function line
      3. Run: npx tsc --noEmit resources/js/lib/utils.ts 2>&1 | tee .sisyphus/evidence/task-6-tsc.txt
      4. Assert exit 0 (no type errors, imports resolve)
    Expected Result: File structure matches shadcn standard; imports resolve cleanly
    Evidence: .sisyphus/evidence/task-6-structure.txt, .sisyphus/evidence/task-6-tsc.txt

  Scenario: cn() runtime behavior via Vitest (deferred to T8)
    Note: Functional test of cn() output is covered by T8 (Vitest unit tests). This task (T6) verifies structural correctness only.
  ```

  **Commit**: NO (groups with T1-T5)

- [ ] 7. Split helper.ts into resources/js/lib/* modules + keep Components/helper.ts as re-export shim

  **What to do**:
  - Read `resources/js/Components/helper.ts` (309 LOC) — identify functions:
    - `api()` — axios wrapper with toast handling → `resources/js/lib/api.ts`
    - `buildCSRFHeaders()` — CSRF token reader → `resources/js/lib/csrf.ts`
    - `Toast()` — custom toast function → `resources/js/lib/toast.ts` (initially exports OLD implementation; T14 replaces internals with sonner)
    - `debounce()` → `resources/js/lib/utils/debounce.ts`
    - `generatePassword()` → `resources/js/lib/utils/password.ts`
    - `clickOutside` Svelte action → `resources/js/lib/hooks/click-outside.ts`
  - Each new file re-exports its function(s)
  - Replace `resources/js/Components/helper.ts` content with a re-export shim:
    ```ts
    // Deprecated: use $lib/* directly. This shim maintains backward compat during migration.
    export { api } from "$lib/api";
    export { buildCSRFHeaders } from "$lib/csrf";
    export { Toast } from "$lib/toast";
    export { debounce } from "$lib/utils/debounce";
    export { generatePassword } from "$lib/utils/password";
    export { clickOutside } from "$lib/hooks/click-outside";
    ```
  - All existing pages/components currently importing from `../Components/helper` continue to work during Wave 3

  **Must NOT do**:
  - Do NOT delete `Components/helper.ts` yet (T28 does final removal)
  - Do NOT change function signatures (backward compat!)
  - Do NOT change `api()` behavior (same axios calls, same Toast side-effects)
  - Do NOT merge `Toast()` into `utils.ts` (separate concern)

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Multi-file refactor requires careful split preserving signatures and semantics
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: NO — needs T3 ($lib alias) and T6 (utils.ts) to exist first
  - **Parallel Group**: Sequential after T3, T6
  - **Blocks**: T8 (tests for split modules), T14 (Toast wiring), T28 (shim removal)
  - **Blocked By**: T3, T6

  **References**:
  - `resources/js/Components/helper.ts:1-309` — source to split (full file)
  - Research: "api() wraps axios with Toast handling; buildCSRFHeaders reads meta; clickOutside is Svelte action"
  - `resources/js/lib/hooks/` (empty dir, ready for click-outside.ts)
  - Existing imports to find and KEEP working:
    - `grep -r "Components/helper" resources/js --include="*.svelte" --include="*.ts"` → list ALL consumers

  **Acceptance Criteria**:
  - [ ] Files exist: `resources/js/lib/api.ts`, `resources/js/lib/csrf.ts`, `resources/js/lib/toast.ts`, `resources/js/lib/utils/debounce.ts`, `resources/js/lib/utils/password.ts`, `resources/js/lib/hooks/click-outside.ts`
  - [ ] Each new file has at least one `export` statement
  - [ ] `resources/js/Components/helper.ts` exists and contains re-export lines only (6 re-exports, < 20 LOC)
  - [ ] `grep -c "export" resources/js/Components/helper.ts` → ≥ 6
  - [ ] `npx tsc --noEmit` → exit 0 (all existing imports still resolve through shim)
  - [ ] Existing pages still run — `npm run build` → exit 0

  **QA Scenarios**:
  ```
  Scenario: All 6 helper functions split into separate lib/* files
    Tool: Bash
    Preconditions: T7 complete
    Steps:
      1. Run: for f in api csrf toast utils/debounce utils/password hooks/click-outside; do test -f "resources/js/lib/$f.ts" && echo "OK: $f"; done > .sisyphus/evidence/task-7-files.txt
      2. Assert output contains 6 "OK:" lines
    Expected Result: All 6 files exist
    Evidence: .sisyphus/evidence/task-7-files.txt

  Scenario: Backward-compat shim works
    Tool: Bash
    Preconditions: T7 complete
    Steps:
      1. Run: grep -c 'from.*Components/helper' resources/js --include="*.svelte" --include="*.ts" -r > .sisyphus/evidence/task-7-existing-imports.txt
      2. Run: npx tsc --noEmit 2>&1 | tee .sisyphus/evidence/task-7-tsc.txt
      3. Assert tsc exits 0 (all existing imports resolve through re-export shim)
    Expected Result: No broken imports across codebase
    Evidence: .sisyphus/evidence/task-7-existing-imports.txt, .sisyphus/evidence/task-7-tsc.txt

  Scenario: Function signatures preserved
    Tool: Bash (via temporary TS test)
    Preconditions: T7 complete
    Steps:
      1. Create .sisyphus/tmp/test-shim.ts with: `import { api, buildCSRFHeaders, Toast, debounce, generatePassword, clickOutside } from "$lib/api"; /* type-check only */`
      2. More robust: import each from its new path, assert type of `Toast` is `(type: string, message: string) => void`
      3. Run: npx tsc --noEmit .sisyphus/tmp/test-shim.ts
    Expected Result: Type check passes — signatures match original
    Evidence: .sisyphus/evidence/task-7-signatures.txt
  ```

  **Commit**: YES (logical milestone — ends Wave 1 foundation)
  - Message: `refactor(lib): split helper.ts into resources/js/lib/* modules with re-export shim`
  - Files: `resources/js/lib/api.ts`, `resources/js/lib/csrf.ts`, `resources/js/lib/toast.ts`, `resources/js/lib/utils/*.ts`, `resources/js/lib/hooks/click-outside.ts`, `resources/js/Components/helper.ts`
  - Pre-commit: `npx tsc --noEmit && npm run build`

- [ ] 8. Vitest unit tests for split lib/* modules

  **What to do**:
  - Create `resources/js/lib/__tests__/utils.test.ts` — test `cn()`:
    - Merges class strings
    - Deduplicates Tailwind conflicts (twMerge behavior)
    - Handles ClassValue variants (string, object, array)
  - Create `resources/js/lib/__tests__/csrf.test.ts` — test `buildCSRFHeaders()`:
    - Reads `<meta name="csrf-token" content="...">` from DOM (use jsdom via Vitest env)
    - Returns `{ 'X-CSRF-TOKEN': '...' }` shape
    - Handles missing meta gracefully
  - Create `resources/js/lib/__tests__/toast.test.ts` — test `Toast()`:
    - Accepts `(type: 'success'|'error'|'info', message: string)` signature
    - Does NOT throw when called
    - (For now) creates DOM element with expected class — updated after T14 to assert sonner mock call
  - Create `resources/js/lib/__tests__/debounce.test.ts` — classic debounce: multiple rapid calls collapse, arguments forwarded, respect delay
  - Create `resources/js/lib/__tests__/password.test.ts` — `generatePassword(length)`: length respected, contains mixed case + numbers + symbols
  - Configure `vitest.config.ts` (create if missing) with `test.environment = 'jsdom'` for csrf/toast tests
  - Install `jsdom` as dev dep if not present: `npm install -D jsdom`

  **Must NOT do**:
  - Do NOT write component tests (`.svelte` file rendering) — out of scope
  - Do NOT use Playwright
  - Do NOT install `@testing-library/svelte`
  - Do NOT mock `axios` globally (only in api.test if it's added later)

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Multi-file test creation with Vitest config setup, needs careful test isolation
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: NO — needs T7 (modules must exist to test)
  - **Parallel Group**: Sequential after T7
  - **Blocks**: None
  - **Blocked By**: T7

  **References**:
  - `package.json:60` — Vitest already in devDeps
  - `package.json:13` — `npm test` script runs `vitest run`
  - Project already has `vitest.config.ts` or similar? Verify; create if not.
  - Existing test files if any: `grep -r "describe\\(" resources --include="*.test.ts"` to find patterns

  **Acceptance Criteria**:
  - [ ] Files exist: `resources/js/lib/__tests__/utils.test.ts`, `csrf.test.ts`, `toast.test.ts`, `debounce.test.ts`, `password.test.ts`
  - [ ] `vitest.config.ts` exists with `test.environment: 'jsdom'`
  - [ ] `jsdom` in `devDependencies` of package.json
  - [ ] `npm test` → all tests PASS, ≥ 5 suite files executed

  **QA Scenarios**:
  ```
  Scenario: All unit tests pass
    Tool: Bash
    Preconditions: T7 + T8 complete
    Steps:
      1. Run: npm test 2>&1 | tee .sisyphus/evidence/task-8-vitest.txt
      2. Assert output contains "passed" and no "failed" test counts
      3. Grep: count suites executed
    Expected Result: All 5 test files pass, 0 failures
    Evidence: .sisyphus/evidence/task-8-vitest.txt

  Scenario: Test environment is jsdom (not node)
    Tool: Bash
    Preconditions: vitest.config.ts exists
    Steps:
      1. Run: grep "environment.*jsdom" vitest.config.ts > .sisyphus/evidence/task-8-env.txt
      2. Assert match
    Expected Result: vitest configured for jsdom environment (needed for DOM-touching tests)
    Evidence: .sisyphus/evidence/task-8-env.txt

  Scenario: No forbidden test deps
    Tool: Bash
    Preconditions: T8 complete
    Steps:
      1. Run: grep -E '"@playwright/test"|"@testing-library/svelte"' package.json > .sisyphus/evidence/task-8-no-forbidden.txt
      2. Assert empty output
    Expected Result: No browser-automation or component-library test deps
    Evidence: .sisyphus/evidence/task-8-no-forbidden.txt
  ```

  **Commit**: NO (groups with T7 as "refactor(lib): split helper.ts + tests")

- [ ] 9. Install shadcn primitives batch 1: button, card, input, label, textarea

  **What to do**:
  - Run: `npx shadcn-svelte@latest add button card input label textarea`
  - CLI writes 5 component directories under `resources/js/lib/components/ui/` (paths resolved via `components.json`)
  - For each generated component: verify it uses `$lib/utils` (cn) import and `hsl(var(--primary))` token
  - Commit files; do NOT hand-edit generated templates (they're updated via CLI if needed)

  **Must NOT do**:
  - Do NOT hand-modify generated component internals unless a bug is found
  - Do NOT commit generated components before verifying `npm run build` passes

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: CLI-driven generation, deterministic output
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES (different batches write to different dirs)
  - **Parallel Group**: Wave 2 with T10-T14
  - **Blocks**: T18-T27 (page rebuilds use these primitives)
  - **Blocked By**: T1, T2, T3, T4, T5

  **References**:
  - `resources/js/lib/components/ui/button/`, `card/`, `input/`, `label/`, `textarea/` (pre-existing empty dirs)
  - `components.json` (T2) — alias config
  - shadcn-svelte CLI docs: `add` command syntax

  **Acceptance Criteria**:
  - [ ] Files exist: `resources/js/lib/components/ui/{button,card,input,label,textarea}/index.ts` (or similar entry)
  - [ ] Each dir has at least one `.svelte` file
  - [ ] `grep -l 'from "\\$lib/utils"' resources/js/lib/components/ui/button/*.svelte` → ≥ 1 match
  - [ ] `npx tsc --noEmit` → exit 0
  - [ ] `npm run build` → exit 0

  **QA Scenarios**:
  ```
  Scenario: All 5 primitives installed
    Tool: Bash
    Steps:
      1. Run: for c in button card input label textarea; do find "resources/js/lib/components/ui/$c" -name "*.svelte" | head -1; done > .sisyphus/evidence/task-9-files.txt
      2. Assert 5 lines, each a valid .svelte path
    Expected Result: 5 components present
    Evidence: .sisyphus/evidence/task-9-files.txt

  Scenario: Components use --primary token
    Tool: Bash
    Steps:
      1. Run: grep -rE "(bg-primary|text-primary|hover:bg-primary)" resources/js/lib/components/ui/button > .sisyphus/evidence/task-9-primary-usage.txt
      2. Assert ≥ 1 match (button uses brand primary)
    Expected Result: Button styled with primary token → will render emerald
    Evidence: .sisyphus/evidence/task-9-primary-usage.txt
  ```

  **Commit**: NO (groups with T10-T13)

- [ ] 10. Install shadcn primitives batch 2: badge, alert, avatar, separator, skeleton

  **What to do**:
  - Run: `npx shadcn-svelte@latest add badge alert avatar separator skeleton`
  - Verify 5 component dirs populated

  **Must NOT do**:
  - Do NOT hand-modify templates
  - Do NOT skip any of the 5

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **Parallelization**: Wave 2, parallel with T9, T11-T14. Blocked by T1-T5.

  **References**: Same as T9. Target dirs: `badge/`, `alert/`, `avatar/`, `separator/`, `skeleton/` (pre-existing empty).

  **Acceptance Criteria**:
  - [ ] 5 dirs populated with `.svelte` files
  - [ ] `npx tsc --noEmit` → exit 0
  - [ ] `npm run build` → exit 0

  **QA Scenarios**:
  ```
  Scenario: All 5 primitives installed
    Tool: Bash
    Steps:
      1. Run: for c in badge alert avatar separator skeleton; do find "resources/js/lib/components/ui/$c" -name "*.svelte" | head -1; done > .sisyphus/evidence/task-10-files.txt
      2. Assert 5 lines
    Expected Result: All present
    Evidence: .sisyphus/evidence/task-10-files.txt
  ```

  **Commit**: NO (groups with T9, T11-T13)

- [ ] 11. Install shadcn primitives batch 3: dialog, sheet, dropdown-menu, tabs

  **What to do**:
  - Run: `npx shadcn-svelte@latest add dialog sheet dropdown-menu tabs`
  - These overlay/modal components use `bits-ui` internally — verify no version conflict post-install
  - Verify Dialog and Sheet have portal roots that render correctly (check built HTML in dev server after T14 wiring)

  **Must NOT do**:
  - Do NOT hand-modify templates
  - Do NOT install `vaul-svelte` separately (bundled via dialog/sheet dep chain)

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **Parallelization**: Wave 2, parallel with T9, T10, T12-T14. Blocked by T1-T5.

  **References**:
  - Target dirs: `dialog/`, `sheet/`, `dropdown-menu/`, `tabs/`
  - Research: "Dialog uses vaul-svelte internally; Select/Dropdown uses bits-ui"

  **Acceptance Criteria**:
  - [ ] 4 dirs populated
  - [ ] `npm ls bits-ui` → single version installed, no conflicts
  - [ ] `npx tsc --noEmit` → exit 0

  **QA Scenarios**:
  ```
  Scenario: Overlays installed and bits-ui satisfied
    Tool: Bash
    Steps:
      1. Run: for c in dialog sheet dropdown-menu tabs; do find "resources/js/lib/components/ui/$c" -name "*.svelte" | head -1; done > .sisyphus/evidence/task-11-files.txt
      2. Run: npm ls bits-ui 2>&1 | tee .sisyphus/evidence/task-11-bits-ui.txt
      3. Assert no "UNMET" / no duplicate version lines in bits-ui tree
    Expected Result: 4 components installed, bits-ui cleanly resolved
    Evidence: .sisyphus/evidence/task-11-files.txt, .sisyphus/evidence/task-11-bits-ui.txt
  ```

  **Commit**: NO (groups with T9-T13)

- [ ] 12. Install shadcn primitives batch 4: select, checkbox, switch

  **What to do**:
  - Run: `npx shadcn-svelte@latest add select checkbox switch`
  - Verify 3 component dirs populated

  **Must NOT do**: Same as T9-T11.

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **Parallelization**: Wave 2, parallel with T9-T11, T13-T14. Blocked by T1-T5.

  **References**: Target dirs `select/`, `checkbox/`, `switch/`.

  **Acceptance Criteria**:
  - [ ] 3 dirs populated
  - [ ] `npx tsc --noEmit` → exit 0

  **QA Scenarios**:
  ```
  Scenario: Form-control primitives installed
    Tool: Bash
    Steps:
      1. Run: for c in select checkbox switch; do find "resources/js/lib/components/ui/$c" -name "*.svelte" | head -1; done > .sisyphus/evidence/task-12-files.txt
      2. Assert 3 lines
    Expected Result: All present
    Evidence: .sisyphus/evidence/task-12-files.txt
  ```

  **Commit**: NO (groups with T9-T13)

- [ ] 13. Install shadcn primitives batch 5: table, pagination, sonner

  **What to do**:
  - Run: `npx shadcn-svelte@latest add table pagination sonner`
  - Sonner component exports `<Toaster />` — needed for T14 wiring
  - Pagination component exports navigation primitives — needed for T16 rebuild

  **Must NOT do**:
  - Do NOT install `svelte-sonner` manually (shadcn handles it)
  - Do NOT hand-modify templates

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **Parallelization**: Wave 2, parallel with T9-T12, T14. Blocked by T1-T5.

  **References**:
  - Target dirs `table/`, `pagination/`, `sonner/`
  - Research: "Sonner requires `<Toaster />` component in your root layout"

  **Acceptance Criteria**:
  - [ ] 3 dirs populated with `.svelte` files
  - [ ] `resources/js/lib/components/ui/sonner/` contains file exporting `Toaster`
  - [ ] `npx tsc --noEmit` → exit 0

  **QA Scenarios**:
  ```
  Scenario: Feedback + data primitives installed
    Tool: Bash
    Steps:
      1. Run: for c in table pagination sonner; do find "resources/js/lib/components/ui/$c" -name "*.svelte" | head -1; done > .sisyphus/evidence/task-13-files.txt
      2. Assert 3 lines
      3. Run: grep -l "Toaster" resources/js/lib/components/ui/sonner/*.svelte
    Expected Result: Toaster exported from sonner component dir
    Evidence: .sisyphus/evidence/task-13-files.txt
  ```

  **Commit**: YES (ends primitive install phase, atomic milestone)
  - Message: `feat(ui): install shadcn-svelte primitive components (20 total)`
  - Files: `resources/js/lib/components/ui/**`
  - Pre-commit: `npx tsc --noEmit && npm run build`

- [ ] 14. Wire Toaster and ModeWatcher into app.js (Inertia entry)

  **What to do**:
  - Read `resources/js/app.js` (28 LOC currently) — understand Inertia mounting pattern
  - Optionally rename to `app.ts` for consistency (keep `app.js` if team prefers minimal churn)
  - In the Inertia `setup()` callback, wrap the mounted component in:
    - `<ModeWatcher />` from `mode-watcher` (provides dark class toggle)
    - `<Toaster />` from `$lib/components/ui/sonner` (provides sonner toast portal)
  - Update `lib/toast.ts` (from T7) internals: import `toast` from `svelte-sonner`, delegate `Toast(type, message)` → `toast[type](message)` (map 'success'/'error'/'info'/'warning' → corresponding sonner methods)
  - Preserve existing dark mode initialization logic (localStorage read) — but defer to mode-watcher's state machine if compatible
  - Ensure CSRF meta tag read path in `buildCSRFHeaders()` still works (no changes to DOM structure)

  **Must NOT do**:
  - Do NOT remove Inertia's `createInertiaApp` call
  - Do NOT change which Pages directory Inertia resolves (`./Pages/**/*.svelte`)
  - Do NOT break existing dark mode class toggling (verify .dark class still applies on <html>)
  - Do NOT introduce a Layout.svelte wrapper if app.js resolve pattern can accept the Toaster/ModeWatcher inline

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Single entry-file edit + one-file toast.ts update, clear integration pattern
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: NO — must follow T7 (toast.ts exists) and T13 (sonner installed)
  - **Parallel Group**: Wave 2, sequential after T7, T13
  - **Blocks**: T15 (DarkModeToggle depends on mode-watcher), T18-T27 (pages use toast)
  - **Blocked By**: T7, T13

  **References**:
  - `resources/js/app.js:1-28` — current Inertia setup
  - `resources/js/lib/components/ui/sonner/*` — Toaster component (from T13)
  - `node_modules/mode-watcher` — ModeWatcher component (from T1)
  - `resources/js/lib/toast.ts` — Toast wrapper (from T7, update internals)
  - Research: "mode-watcher handles localStorage + .dark class + system preference"

  **Acceptance Criteria**:
  - [ ] `resources/js/app.{js,ts}` imports `ModeWatcher` and `Toaster`
  - [ ] `grep -E "ModeWatcher|Toaster" resources/js/app.*` → ≥ 2 matches
  - [ ] `resources/js/lib/toast.ts` imports `toast` from `svelte-sonner`
  - [ ] `grep "from 'svelte-sonner'" resources/js/lib/toast.ts` → 1 match (or similar)
  - [ ] `npm run dev` starts without errors (wait 5s, curl / should return 200)
  - [ ] `npm run build` → exit 0
  - [ ] Dark mode still toggles: inject JS via curl trick OR check via grep that `.dark` class is still used in CSS

  **QA Scenarios**:
  ```
  Scenario: Toaster and ModeWatcher wired
    Tool: Bash
    Steps:
      1. Run: grep -E "import.*ModeWatcher|import.*Toaster" resources/js/app.* > .sisyphus/evidence/task-14-imports.txt
      2. Assert 2 import lines
    Expected Result: Both imported in app entry
    Evidence: .sisyphus/evidence/task-14-imports.txt

  Scenario: Toast wrapper delegates to sonner
    Tool: Bash
    Steps:
      1. Run: grep -E "toast\\.success|toast\\.error|toast\\.info" resources/js/lib/toast.ts > .sisyphus/evidence/task-14-sonner-delegate.txt
      2. Assert ≥ 2 sonner method calls (for mapping types)
    Expected Result: Toast() delegates to sonner methods
    Evidence: .sisyphus/evidence/task-14-sonner-delegate.txt

  Scenario: Dev server starts
    Tool: Bash
    Steps:
      1. Run: npm run dev &
      2. Wait 8s: sleep 8
      3. Run: curl -sI http://localhost:5555/ | head -1 > .sisyphus/evidence/task-14-dev-server.txt
      4. Kill: kill %1
      5. Assert first line contains "200" or "302"
    Expected Result: Dev server responds
    Evidence: .sisyphus/evidence/task-14-dev-server.txt
  ```

  **Commit**: YES
  - Message: `feat(app): wire Toaster and ModeWatcher into Inertia entry`
  - Files: `resources/js/app.{js,ts}`, `resources/js/lib/toast.ts`
  - Pre-commit: `npx tsc --noEmit && npm run build`

- [ ] 15. Rebuild Components/DarkModeToggle.svelte using mode-watcher

  **What to do**:
  - Read current `resources/js/Components/DarkModeToggle.svelte` (73 LOC) — understand props (`onchange` callback) and state (`darkMode`, `mounted`)
  - Rebuild using `mode-watcher` primitives:
    - Import `mode` (reactive store) and `toggleMode` (setter) from `mode-watcher`
    - Use shadcn `Button` with Sun/Moon icons from `@lucide/svelte`
    - On click: call `toggleMode()` then invoke `onchange` callback (preserve signature for Header.svelte usage)
  - Keep the file at `resources/js/Components/DarkModeToggle.svelte` (same path)
  - File should be ~30-40 LOC after rewrite (less boilerplate thanks to mode-watcher)

  **Must NOT do**:
  - Do NOT move the file — Header.svelte imports it by this path
  - Do NOT remove the `onchange` callback prop (Header.svelte may subscribe)
  - Do NOT manually read/write localStorage (mode-watcher handles it)
  - Do NOT use media query listeners (mode-watcher handles system pref)

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Single-file component rebuild with well-defined library substitution
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES (independent of other Wave 2 tasks except T14)
  - **Parallel Group**: Wave 2, after T1 (deps), T9 (Button component), T14 (mode-watcher wired)
  - **Blocks**: T22 (Header consumes DarkModeToggle)
  - **Blocked By**: T1, T9, T14

  **References**:
  - `resources/js/Components/DarkModeToggle.svelte:1-73` — current implementation (reference for props API)
  - `resources/js/lib/components/ui/button/` — shadcn Button (from T9)
  - `@lucide/svelte` — import Sun, Moon icons
  - `mode-watcher` npm package — `mode` store and `toggleMode` function
  - Svelte 5 runes: `$props()` to receive `onchange` callback

  **Acceptance Criteria**:
  - [ ] File `resources/js/Components/DarkModeToggle.svelte` exists
  - [ ] `grep 'from .mode-watcher.' resources/js/Components/DarkModeToggle.svelte` → 1 match
  - [ ] `grep -E 'Sun|Moon' resources/js/Components/DarkModeToggle.svelte` → ≥ 1 match (Lucide icons)
  - [ ] `grep 'localStorage' resources/js/Components/DarkModeToggle.svelte` → no matches (delegated to mode-watcher)
  - [ ] `grep 'export let onchange|let { onchange }' resources/js/Components/DarkModeToggle.svelte` → 1 match (prop preserved)
  - [ ] `npx tsc --noEmit` → exit 0
  - [ ] `npm run build` → exit 0

  **QA Scenarios**:
  ```
  Scenario: Mode-watcher integration
    Tool: Bash
    Steps:
      1. Run: grep -E "mode-watcher|toggleMode" resources/js/Components/DarkModeToggle.svelte > .sisyphus/evidence/task-15-mode-watcher.txt
      2. Assert ≥ 2 matches
    Expected Result: File uses mode-watcher APIs
    Evidence: .sisyphus/evidence/task-15-mode-watcher.txt

  Scenario: localStorage direct access removed
    Tool: Bash
    Steps:
      1. Run: grep -c "localStorage\\|window.matchMedia" resources/js/Components/DarkModeToggle.svelte > .sisyphus/evidence/task-15-no-direct.txt
      2. Assert count = 0
    Expected Result: No manual storage/media-query logic
    Evidence: .sisyphus/evidence/task-15-no-direct.txt

  Scenario: Dark class still applies at runtime
    Tool: Bash
    Steps:
      1. Run: npm run dev &
      2. sleep 8
      3. curl -s http://localhost:5555/ > .sisyphus/evidence/task-15-page.html
      4. Grep for "mode-watcher" or darkmode script hooks in the HTML
      5. kill %1
    Expected Result: Page contains mode-watcher runtime markers (or at minimum, no runtime errors in response)
    Evidence: .sisyphus/evidence/task-15-page.html
  ```

  **Commit**: NO (groups with T16-T17 as "refactor(components): rebuild shared components")

- [ ] 16. Rebuild Components/Pagination.svelte using shadcn Pagination

  **What to do**:
  - Read current `resources/js/Components/Pagination.svelte` (55 LOC) — props: `meta` (pagination metadata object), `preserveState` (boolean for router.visit)
  - Rebuild using shadcn Pagination primitives: `Pagination`, `PaginationContent`, `PaginationItem`, `PaginationLink`, `PaginationPrevious`, `PaginationNext`, `PaginationEllipsis` (from `$lib/components/ui/pagination`)
  - Preserve the `router.visit(url, { preserveState })` click behavior (Inertia navigation)
  - Preserve URL param logic: `?page=N` appended to current URL
  - Keep file at `resources/js/Components/Pagination.svelte` — users.svelte and dashboard.svelte import it

  **Must NOT do**:
  - Do NOT move the file path
  - Do NOT change prop names (`meta`, `preserveState`)
  - Do NOT break the `preserveState` semantic (Inertia preserves component state during page change)

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2, after T13 (shadcn pagination installed)
  - **Blocks**: T24 (users.svelte uses Pagination), T26 (dashboard.svelte may use it)
  - **Blocked By**: T13

  **References**:
  - `resources/js/Components/Pagination.svelte:1-55` — current implementation
  - `resources/js/lib/components/ui/pagination/` — shadcn primitives (from T13)
  - Inertia `router.visit` — keep usage identical
  - Backend pagination meta shape: `{current_page, per_page, total, last_page, hasNext, hasPrev, search, filter}`

  **Acceptance Criteria**:
  - [ ] `grep 'from .\\$lib/components/ui/pagination' resources/js/Components/Pagination.svelte` → 1 match
  - [ ] `grep 'router.visit' resources/js/Components/Pagination.svelte` → ≥ 1 match (preserved)
  - [ ] `grep -E 'export let meta|let \\{ meta' resources/js/Components/Pagination.svelte` → 1 match (note: `{` escaped for POSIX ERE)
  - [ ] `npx tsc --noEmit` → exit 0

  **QA Scenarios**:
  ```
  Scenario: Shadcn pagination primitives used
    Tool: Bash
    Steps:
      1. Run: grep -cE "PaginationContent|PaginationItem|PaginationLink|PaginationNext|PaginationPrevious" resources/js/Components/Pagination.svelte > .sisyphus/evidence/task-16-primitives.txt
      2. Assert count ≥ 3
    Expected Result: Shadcn pagination composition used
    Evidence: .sisyphus/evidence/task-16-primitives.txt

  Scenario: Inertia navigation preserved
    Tool: Bash
    Steps:
      1. Run: grep "router.visit" resources/js/Components/Pagination.svelte > .sisyphus/evidence/task-16-inertia.txt
      2. Assert ≥ 1 match
    Expected Result: router.visit still invoked for page changes
    Evidence: .sisyphus/evidence/task-16-inertia.txt
  ```

  **Commit**: NO (groups with T15, T17)

- [ ] 17. Verify Can.svelte and NaraIcon.svelte compatibility

  **What to do**:
  - Read `resources/js/Components/Can.svelte` (23 LOC) and `resources/js/Components/NaraIcon.svelte` (3 LOC)
  - Verify they still compile against updated Tailwind config and $lib alias
  - If they use `primary-*` utility: no change needed (utility still works after T4)
  - If they use `@layer components` utility (`.card`, etc.): no change needed until T29 cleanup
  - Document any findings in task evidence (likely: "No changes required")

  **Must NOT do**:
  - Do NOT rewrite Can.svelte's permission logic
  - Do NOT change NaraIcon's image path
  - Do NOT invent props that don't exist

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Verification-only task, expected zero-change
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2
  - **Blocks**: None (but unblocks confidence for T22-T27 Header/Pages that use Can)
  - **Blocked By**: T3 ($lib alias in case internal imports change)

  **References**:
  - `resources/js/Components/Can.svelte:1-23`
  - `resources/js/Components/NaraIcon.svelte:1-3`

  **Acceptance Criteria**:
  - [ ] Both files still compile: `npx tsc --noEmit` → exit 0
  - [ ] `npm run build` → exit 0
  - [ ] File LOC within ±2 of original (Can: 21-25, NaraIcon: 1-5)
  - [ ] `grep -r "from.*Can\\|from.*NaraIcon" resources/js` still resolves (grep for import sites)

  **QA Scenarios**:
  ```
  Scenario: Both files compile unchanged
    Tool: Bash
    Steps:
      1. Run: wc -l resources/js/Components/Can.svelte resources/js/Components/NaraIcon.svelte > .sisyphus/evidence/task-17-loc.txt
      2. Run: npx tsc --noEmit 2>&1 | tee -a .sisyphus/evidence/task-17-tsc.txt
      3. Assert tsc exits 0 and LOC delta is minimal
    Expected Result: No regressions
    Evidence: .sisyphus/evidence/task-17-loc.txt, .sisyphus/evidence/task-17-tsc.txt
  ```

  **Commit**: YES (ends Wave 2)
  - Message: `refactor(components): rebuild shared components with shadcn primitives`
  - Files: `resources/js/Components/DarkModeToggle.svelte`, `resources/js/Components/Pagination.svelte`
  - Pre-commit: `npx tsc --noEmit && npm run build && npm test`

- [ ] 18. Rebuild Pages/auth/login.svelte with shadcn primitives

  **What to do**:
  - Read current `resources/js/Pages/auth/login.svelte` (140 LOC) — preserve:
    - `let { error } = $props()` and `let form = $state({...})`
    - `router.post('/login', {...form})` on submit
    - Google OAuth link (redirect to `/google/redirect`)
    - `$effect` that shows Toast on error prop
  - Rebuild layout using:
    - Shadcn `Card` as main auth container (CardHeader, CardContent, CardFooter)
    - Shadcn `Input` for email/phone + password fields (wrap in Label components)
    - Shadcn `Button` for submit (loading state via `disabled + Loader2 icon` from Lucide)
    - Shadcn `Button variant="outline"` for Google OAuth with GoogleIcon custom SVG (current has inline SVG, keep it)
    - Shadcn `Alert` for error display (replace inline error block)
  - Update Toast call: `import { Toast } from '$lib/toast'` (or keep via `../Components/helper` shim until T28)
  - Preserve visual: emerald primary accents via `bg-primary` and `--primary` CSS var
  - Target LOC: 100-120 (reduced boilerplate)

  **Must NOT do**:
  - Do NOT change route URL (`/login`), method (POST), payload (`{email, phone, password}`)
  - Do NOT remove `router.post` call
  - Do NOT remove Google OAuth button
  - Do NOT introduce a client-side routing alternative
  - Do NOT redesign the page layout paradigm (moderate refresh: centered card on gradient background is fine)

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: UI rebuild task requires typographic hierarchy, spacing decisions, a11y considerations within shadcn idioms
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3, parallel with T19-T27
  - **Blocks**: None
  - **Blocked By**: T9 (Button, Input, Card, Label), T10 (Alert), T14 (Toast wrapper)

  **References**:
  - `resources/js/Pages/auth/login.svelte:1-140` — current implementation (reference for state/effects/handlers)
  - `resources/js/lib/components/ui/{card,input,button,label,alert}/` — primitives
  - `resources/js/lib/toast.ts` — Toast wrapper
  - Backend contract: `POST /login {email|phone, password}` returns redirect (not JSON)
  - AuthController notes: rate-limited via strictRateLimit(); error sent back via cookie redirect

  **Acceptance Criteria**:
  - [ ] File `resources/js/Pages/auth/login.svelte` exists
  - [ ] `grep 'router.post..\/login' resources/js/Pages/auth/login.svelte` → ≥ 1 match
  - [ ] `grep -E 'import.*Card|import.*Input|import.*Button|import.*Alert' resources/js/Pages/auth/login.svelte` → ≥ 4 matches
  - [ ] `grep 'google/redirect' resources/js/Pages/auth/login.svelte` → ≥ 1 match
  - [ ] `npx tsc --noEmit` → exit 0
  - [ ] `npm run build` → exit 0
  - [ ] Page responds 200 via curl: `curl -sI http://localhost:5555/login | head -1` → contains "200"

  **QA Scenarios**:
  ```
  Scenario: Login page renders with shadcn primitives
    Tool: Bash
    Steps:
      1. npm run dev &
      2. sleep 8
      3. curl -s http://localhost:5555/login > .sisyphus/evidence/task-18-page.html
      4. Grep for "data-slot" or shadcn-specific class prefixes: grep -cE 'data-slot|data-melt' .sisyphus/evidence/task-18-page.html > .sisyphus/evidence/task-18-primitives.txt
      5. Assert count > 0
      6. kill %1
    Expected Result: Page renders with shadcn markers present
    Evidence: .sisyphus/evidence/task-18-page.html, .sisyphus/evidence/task-18-primitives.txt

  Scenario: POST /login submits and responds (rate-limit-aware)
    Tool: Bash
    Steps:
      1. npm run dev &
      2. sleep 8
      3. curl -s -c cookies.txt -X POST http://localhost:5555/login -d "email=nonexistent@test.com&password=wrong" -H "Content-Type: application/x-www-form-urlencoded" -i > .sisyphus/evidence/task-18-login-post.txt
      4. Assert response is 302 (redirect back to /login with error cookie) OR 429 (rate-limited — still valid endpoint response)
      5. kill %1
    Expected Result: Endpoint reachable, contract intact
    Evidence: .sisyphus/evidence/task-18-login-post.txt
  ```

  **Commit**: NO (groups with T19-T21 as "refactor(auth): rebuild auth pages")

- [ ] 19. Rebuild Pages/auth/register.svelte with shadcn primitives

  **What to do**:
  - Read current `resources/js/Pages/auth/register.svelte` (178 LOC)
  - Preserve: `{ error } = $props()`, `form = $state({name, email, phone, password, password_confirmation})`, `router.post('/register', form)`, password-generator button, Google OAuth button, `$effect` error Toast
  - Rebuild with: `Card`, `Input`, `Label`, `Button`, `Alert` from `$lib/components/ui`
  - Password generator button can be a shadcn `Button variant="outline" size="sm"` next to the password field
  - Target LOC: 130-150

  **Must NOT do**: (same as T18 — no route/payload changes, no new flows)

  **Recommended Agent Profile**: `visual-engineering`, skills: []

  **Parallelization**: Wave 3, parallel with T18, T20-T27. Blocked by T9, T10, T14.

  **References**: `resources/js/Pages/auth/register.svelte:1-178`, `lib/utils/password.ts` (for generator), backend `POST /register {name, email, phone?, password}`.

  **Acceptance Criteria**:
  - [ ] `grep 'router.post..\/register' resources/js/Pages/auth/register.svelte` → ≥ 1 match
  - [ ] `grep -E 'import.*Card|Input|Button|Label' resources/js/Pages/auth/register.svelte` → ≥ 4 matches
  - [ ] Password-generator button present (`grep -i generate` → ≥ 1 match)
  - [ ] `npx tsc --noEmit` → exit 0, `npm run build` → exit 0
  - [ ] `curl -sI http://localhost:5555/register | head -1` contains "200"

  **QA Scenarios**:
  ```
  Scenario: Register page with shadcn primitives
    Tool: Bash
    Steps:
      1. npm run dev & ; sleep 8
      2. curl -s http://localhost:5555/register > .sisyphus/evidence/task-19-page.html
      3. grep -cE "data-slot|data-melt" .sisyphus/evidence/task-19-page.html > .sisyphus/evidence/task-19-primitives.txt
      4. kill %1
    Expected Result: Page renders; shadcn markers present
    Evidence: .sisyphus/evidence/task-19-page.html

  Scenario: POST /register reachable
    Tool: Bash
    Steps:
      1. npm run dev & ; sleep 8
      2. curl -s -X POST http://localhost:5555/register -d "name=X&email=x@x.com&password=12345" -H "Content-Type: application/x-www-form-urlencoded" -i | head -5 > .sisyphus/evidence/task-19-post.txt
      3. Assert 302 OR 429 OR 422 (valid backend response, not 500)
      4. kill %1
    Expected Result: Endpoint accepts request
    Evidence: .sisyphus/evidence/task-19-post.txt
  ```

  **Commit**: NO (groups with T18, T20, T21)

- [ ] 20. Rebuild Pages/auth/forgot-password.svelte with shadcn primitives

  **What to do**:
  - Read current `resources/js/Pages/auth/forgot-password.svelte` (97 LOC)
  - Preserve: `{ error, id } = $props()`, `success = $state(false)`, `form = $state({email})`, POST /forgot-password via `api()` wrapper, success state hides form and shows Alert
  - Rebuild with: `Card` container, `Input` for email, `Button` for submit, `Alert variant="default"` for success message, `Alert variant="destructive"` for error
  - Target LOC: 70-85

  **Must NOT do**: no route/payload changes.

  **Recommended Agent Profile**: `visual-engineering`, skills: []

  **Parallelization**: Wave 3, parallel with T18, T19, T21-T27. Blocked by T9, T10, T14.

  **References**: `resources/js/Pages/auth/forgot-password.svelte:1-97`, `$lib/api.ts` for `api()` wrapper, backend `POST /forgot-password {email}`.

  **Acceptance Criteria**:
  - [ ] `grep 'forgot-password' resources/js/Pages/auth/forgot-password.svelte` → matches endpoint usage
  - [ ] Alert used for both success and error states (`grep -c "Alert" resources/js/Pages/auth/forgot-password.svelte` → ≥ 2 usage sites)
  - [ ] `npx tsc --noEmit` → exit 0
  - [ ] `curl -sI http://localhost:5555/forgot-password | head -1` contains "200"

  **QA Scenarios**:
  ```
  Scenario: Forgot password page renders
    Tool: Bash
    Steps:
      1. npm run dev & ; sleep 8
      2. curl -s http://localhost:5555/forgot-password > .sisyphus/evidence/task-20-page.html
      3. Grep for Input component markers; grep for alert markers
      4. kill %1
    Expected Result: Page renders without errors
    Evidence: .sisyphus/evidence/task-20-page.html
  ```

  **Commit**: NO (groups with T18-T21)

- [ ] 21. Rebuild Pages/auth/reset-password.svelte with shadcn primitives

  **What to do**:
  - Read current `resources/js/Pages/auth/reset-password.svelte` (106 LOC)
  - Preserve: `{ id, error } = $props()`, `form = $state({password, password_confirmation})`, `router.post('/reset-password', {password, password_confirmation, id})`, password generator button, error Toast via `$effect`
  - Rebuild with: `Card`, `Input type="password"`, `Label`, `Button`, `Alert`
  - Target LOC: 80-95

  **Must NOT do**: same constraints.

  **Recommended Agent Profile**: `visual-engineering`, skills: []

  **Parallelization**: Wave 3, parallel with T18-T20, T22-T27. Blocked by T9, T14.

  **References**: `resources/js/Pages/auth/reset-password.svelte:1-106`, backend `POST /reset-password {password, password_confirmation, id}`.

  **Acceptance Criteria**:
  - [ ] `grep 'router.post..\/reset-password' resources/js/Pages/auth/reset-password.svelte` → ≥ 1 match
  - [ ] Shadcn primitives imported (Card, Input, Button, Label)
  - [ ] `npx tsc --noEmit` → exit 0
  - [ ] Rate-limit-safe curl: only check page rendering, not POST (to avoid hitting rate limiter): `curl -sI "http://localhost:5555/reset-password?id=test" | head -1` contains "200"

  **QA Scenarios**:
  ```
  Scenario: Reset password page renders
    Tool: Bash
    Steps:
      1. npm run dev & ; sleep 8
      2. curl -s "http://localhost:5555/reset-password?id=test-token" > .sisyphus/evidence/task-21-page.html
      3. grep -cE "data-slot|data-melt" .sisyphus/evidence/task-21-page.html
      4. kill %1
    Expected Result: Page renders with shadcn markers; reset token is passed via id prop
    Evidence: .sisyphus/evidence/task-21-page.html
  ```

  **Commit**: YES (ends auth pages migration)
  - Message: `refactor(auth): rebuild auth pages with shadcn primitives`
  - Files: `resources/js/Pages/auth/login.svelte`, `.../register.svelte`, `.../forgot-password.svelte`, `.../reset-password.svelte`
  - Pre-commit: `npx tsc --noEmit && npm run build`

- [ ] 22. Rebuild Components/Header.svelte with NavigationMenu/Sheet/DropdownMenu

  **What to do**:
  - Read current `resources/js/Components/Header.svelte` (247 LOC) — understand: `group` prop, scroll-based backdrop blur, menu open/close state, user dropdown, auth-aware rendering, dark mode toggle integration, logout POST
  - Rebuild with:
    - Desktop nav: top-bar with `NaraIcon`, horizontal nav link list, right-aligned cluster containing `DarkModeToggle`, user avatar, `DropdownMenu` (profile/logout)
    - Mobile nav: `Sheet` triggered by hamburger Button (replaces current full-screen overlay)
    - Use `@lucide/svelte` icons (Menu, X, LogOut, User) instead of inline SVGs
    - Preserve `router.post('/logout')` — submit via Button onClick with `buildCSRFHeaders()`
    - `<Can permission="users.view">` wrap for Users link continues to work
  - Target LOC: 170-210

  **Must NOT do**:
  - Do NOT break the `group` prop API (pages pass it for active-state highlighting)
  - Do NOT remove `Can` wrapping around protected links
  - Do NOT change logout endpoint (POST /logout)
  - Do NOT remove DarkModeToggle integration
  - Do NOT invent new menu items beyond what exists

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: Complex UI composition with multiple shadcn primitives, responsive breakpoints, a11y
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3
  - **Blocks**: T24, T25, T26, T27 (all pages import Header)
  - **Blocked By**: T7, T11 (Sheet, DropdownMenu), T15 (DarkModeToggle rebuilt)

  **References**:
  - `resources/js/Components/Header.svelte:1-247`
  - `resources/js/lib/components/ui/{sheet,dropdown-menu,avatar,button}/`
  - `resources/js/lib/csrf.ts` (for logout CSRF headers)
  - Backend: `POST /logout` (requires auth + CSRF)

  **Acceptance Criteria**:
  - [ ] `grep -E "import.*Sheet|import.*DropdownMenu|import.*Avatar" resources/js/Components/Header.svelte` → ≥ 3 matches
  - [ ] `grep "router.post..\\/logout" resources/js/Components/Header.svelte` → ≥ 1 match
  - [ ] `grep "Can" resources/js/Components/Header.svelte` → ≥ 1 match
  - [ ] `grep -E "export let group|let \\{ group" resources/js/Components/Header.svelte` → 1 match
  - [ ] `npx tsc --noEmit` → exit 0; `npm run build` → exit 0

  **QA Scenarios**:
  ```
  Scenario: Header renders with new primitives
    Tool: Bash
    Steps:
      1. npm run dev & ; sleep 8
      2. curl -s -L http://localhost:5555/ > .sisyphus/evidence/task-22-page.html
      3. grep -cE "data-slot|data-melt|aria-haspopup" .sisyphus/evidence/task-22-page.html > .sisyphus/evidence/task-22-markers.txt
      4. kill %1
    Expected Result: Markers indicate shadcn primitives rendering
    Evidence: .sisyphus/evidence/task-22-page.html

  Scenario: Logout endpoint intact
    Tool: Bash
    Steps:
      1. Login first to get cookies
      2. curl -X POST http://localhost:5555/logout -b cookies.txt -i | head -5 > .sisyphus/evidence/task-22-logout.txt
      3. Expect 302 redirect to /
    Expected Result: Logout contract honored
    Evidence: .sisyphus/evidence/task-22-logout.txt
  ```

  **Commit**: NO (groups with T23)

- [ ] 23. Rebuild Components/UserModal.svelte with shadcn Dialog + form primitives

  **What to do**:
  - Read current `resources/js/Components/UserModal.svelte` (242 LOC) — props: `show`, `mode` ('create'|'edit'), `form` (UserForm), `isSubmitting`. Dispatches `submit` and `close` events.
  - Rebuild with:
    - `Dialog` from `$lib/components/ui/dialog` — bind `show` to Dialog open state
    - `DialogHeader`, `DialogTitle`, `DialogContent`, `DialogFooter`
    - `Input` for name, email, phone; `Input type="password"` for password
    - `Switch` for `is_verified` and `is_admin` flags
    - `Checkbox` or multi-select group for `roles` array
    - `Button` for Save (loading state: Lucide Loader2 + disabled), `Button variant="outline"` for Cancel
  - Preserve event dispatch: `dispatch('submit', formData)`, `dispatch('close')`
  - Preserve form field names: `name`, `email`, `phone`, `password`, `is_verified`, `roles`
  - Target LOC: 170-200

  **Must NOT do**:
  - Do NOT change prop names or event names
  - Do NOT remove any form fields
  - Do NOT hardcode roles list (read dynamically as before)
  - Do NOT add validation that rejects previously-valid inputs

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: Modal with complex form composition, multiple primitive types, preserved event API
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3
  - **Blocks**: T24
  - **Blocked By**: T9 (Input, Button, Label), T11 (Dialog), T12 (Switch, Checkbox), T14 (Toast)

  **References**:
  - `resources/js/Components/UserModal.svelte:1-242`
  - `resources/js/lib/components/ui/{dialog,input,switch,checkbox,button,label}/`
  - Backend: `POST /users`, `PUT /users/:id` accept `{name, email, phone?, password?, is_verified?, roles[]}`

  **Acceptance Criteria**:
  - [ ] `grep -E "import.*Dialog|import.*Switch|import.*Checkbox" resources/js/Components/UserModal.svelte` → ≥ 3 matches
  - [ ] `grep -E "createEventDispatcher|dispatch\\(" resources/js/Components/UserModal.svelte` → ≥ 2 matches
  - [ ] `grep -E "export let show|let \\{ show" resources/js/Components/UserModal.svelte` → 1 match
  - [ ] `grep -cE "name|email|phone|password|is_verified|roles" resources/js/Components/UserModal.svelte` → ≥ 6
  - [ ] `npx tsc --noEmit` → exit 0; `npm run build` → exit 0

  **QA Scenarios**:
  ```
  Scenario: UserModal compiles and exports expected API
    Tool: Bash
    Steps:
      1. Run: npx tsc --noEmit 2>&1 | tee .sisyphus/evidence/task-23-typecheck.txt
      2. Assert exit 0
    Expected Result: No type errors
    Evidence: .sisyphus/evidence/task-23-typecheck.txt

  Scenario: Form field names preserved
    Tool: Bash
    Steps:
      1. Run: grep -oE "(name|email|phone|password|is_verified|roles)" resources/js/Components/UserModal.svelte | sort -u > .sisyphus/evidence/task-23-fields.txt
      2. Assert all 6 field names present
    Expected Result: No field renames
    Evidence: .sisyphus/evidence/task-23-fields.txt
  ```

  **Commit**: YES
  - Message: `refactor(components): rebuild Header and UserModal with shadcn primitives`
  - Files: `resources/js/Components/Header.svelte`, `resources/js/Components/UserModal.svelte`
  - Pre-commit: `npx tsc --noEmit && npm run build`

- [ ] 24. Rebuild Pages/users.svelte with shadcn primitives

  **What to do**:
  - Read current `resources/js/Pages/users.svelte` (274 LOC). Preserve:
    - `$props()`: users, total, page, limit, totalPages, hasNext, hasPrev, search, filter
    - `$state()`: showUserModal, isSubmitting, mode, form
    - CRUD handlers (openCreate, openEdit, handleSubmit, handleDelete)
    - fetch calls: `GET /users/data`, `POST /users`, `PUT /users/:id`, `DELETE /users {ids:[]}`
  - Rebuild with:
    - Shadcn `Table` primitives (TableHeader, TableBody, TableRow, TableCell, TableHead) — canonical for list views
    - `Badge` for verified status and role indicators
    - `Avatar` with initials fallback
    - `Button variant="outline"` / `"ghost"` for row actions (Edit, Delete)
    - Updated `UserModal` (T23) for create/edit
    - Updated `Pagination` (T16) for page navigation
    - `Alert` for empty state
    - Include `<Header group="users" />`
  - Preserve CSRF via `buildCSRFHeaders()` on mutations
  - Target LOC: 200-240

  **Must NOT do**:
  - Do NOT change any endpoint URLs or request shapes
  - Do NOT add client-side pagination
  - Do NOT remove bulk delete support
  - Do NOT invent new user actions

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: Complex page with CRUD table, pagination, modal orchestration
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3
  - **Blocks**: T28
  - **Blocked By**: T9-T13, T16, T22, T23, T14

  **References**:
  - `resources/js/Pages/users.svelte:1-274`
  - `resources/js/lib/components/ui/{table,badge,avatar,button,alert}/`
  - Backend: `GET /users/data`, `POST /users`, `PUT /users/:id`, `DELETE /users {ids:[]}`
  - `$lib/api.ts`, `$lib/csrf.ts`, `$lib/toast.ts`

  **Acceptance Criteria**:
  - [ ] `grep -E "POST.*\\/users|PUT.*\\/users|DELETE.*\\/users" resources/js/Pages/users.svelte` → ≥ 3 matches
  - [ ] `grep -E "import.*Table|import.*Badge|import.*Avatar|import.*Button" resources/js/Pages/users.svelte` → ≥ 4 matches
  - [ ] `grep "UserModal" resources/js/Pages/users.svelte` → ≥ 1 match
  - [ ] `grep "Pagination" resources/js/Pages/users.svelte` → ≥ 1 match
  - [ ] `grep -E "buildCSRFHeaders|csrf" resources/js/Pages/users.svelte` → ≥ 1 match
  - [ ] `npx tsc --noEmit` → exit 0; `npm run build` → exit 0

  **QA Scenarios**:

  > **Precondition**: Admin user must exist in DB. If not present, run `node nara db:seed` first to seed test admin.
  > Credentials used below are placeholders — substitute with seeded admin credentials at execution time.

  ```
  Scenario: Users page renders (authenticated)
    Tool: Bash
    Preconditions: Dev server running; admin credentials available (seed if needed)
    Steps:
      1. npm run dev & ; sleep 8
      2. Login to get session cookies (substitute real admin credentials):
         curl -s -c cookies.txt -X POST http://localhost:5555/login -d "email=admin@nara.test&password=seedpass" -H "Content-Type: application/x-www-form-urlencoded"
      3. curl -s -b cookies.txt http://localhost:5555/users > .sisyphus/evidence/task-24-page.html
      4. grep -cE "data-slot|<table" .sisyphus/evidence/task-24-page.html > .sisyphus/evidence/task-24-primitives.txt
      5. Assert count > 0
      6. kill %1
    Expected Result: Page renders with shadcn Table markers
    Evidence: .sisyphus/evidence/task-24-page.html, .sisyphus/evidence/task-24-primitives.txt

  Scenario: GET /users/data returns JSON
    Tool: Bash
    Steps:
      1. With auth cookie: curl -s -b cookies.txt "http://localhost:5555/users/data?page=1" > .sisyphus/evidence/task-24-json.json
      2. Assert valid JSON with users/data/total keys
    Expected Result: Endpoint JSON shape unchanged
    Evidence: .sisyphus/evidence/task-24-json.json

  Scenario: DELETE bulk endpoint intact
    Tool: Bash
    Steps:
      1. curl -s -b cookies.txt -X DELETE http://localhost:5555/users -H "Content-Type: application/json" -d '{"ids":[]}' -i | head -5 > .sisyphus/evidence/task-24-delete.txt
      2. Expect 200 with deleted:0 OR 422, NOT 404/500
    Expected Result: Contract intact
    Evidence: .sisyphus/evidence/task-24-delete.txt
  ```

  **Commit**: NO (groups with T25-T27)

- [ ] 25. Rebuild Pages/profile.svelte with shadcn primitives

  **What to do**:
  - Read current `resources/js/Pages/profile.svelte` (373 LOC). Preserve:
    - `{ user } = $props()`
    - `$state()`: current_password, new_password, confirm_password, isLoading, previewUrl
    - Handlers: avatar upload (`POST /assets/avatar` FormData), profile update (`POST /change-profile`), password change (`POST /change-password`)
  - Rebuild with:
    - Shadcn `Card` sections for: "Profile Info", "Change Password", "Avatar"
    - Optional: `Tabs` to organize sections OR stacked cards (pick one consistent pattern)
    - `Avatar` primitive with fallback initials; upload via styled Button + hidden file input
    - `Input`, `Label`, `Button` for form fields
    - `Alert` for success/error feedback (replacing inline messages)
  - Include `<Header group="profile" />`
  - Target LOC: 270-320

  **Must NOT do**:
  - Do NOT change endpoints (POST /assets/avatar, POST /change-profile, POST /change-password)
  - Do NOT switch avatar upload to JSON (must stay multipart/form-data)
  - Do NOT remove password confirmation validation
  - Do NOT remove loading state indicators

  **Recommended Agent Profile**: `visual-engineering`, skills: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3
  - **Blocks**: T28
  - **Blocked By**: T9, T10, T22, T14

  **References**:
  - `resources/js/Pages/profile.svelte:1-373`
  - Backend: `POST /assets/avatar` multipart → JSON {url}; `POST /change-profile {name, email, phone?}`; `POST /change-password {current_password, new_password}`

  **Acceptance Criteria**:
  - [ ] `grep -E "assets\\/avatar|change-profile|change-password" resources/js/Pages/profile.svelte` → ≥ 3 matches
  - [ ] `grep "FormData" resources/js/Pages/profile.svelte` → ≥ 1 match (multipart preserved)
  - [ ] Shadcn primitives imported: Card, Avatar, Input, Button, Label (≥ 4 imports)
  - [ ] `npx tsc --noEmit` → exit 0

  **QA Scenarios**:
  ```
  Scenario: Profile page renders (authenticated)
    Tool: Bash
    Steps:
      1. npm run dev & ; sleep 8
      2. Login, save cookies
      3. curl -s -b cookies.txt http://localhost:5555/profile > .sisyphus/evidence/task-25-page.html
      4. Grep for Card/Avatar markers
      5. kill %1
    Expected Result: Page renders
    Evidence: .sisyphus/evidence/task-25-page.html

  Scenario: POST /change-profile endpoint reachable
    Tool: Bash
    Steps:
      1. CSRF_TOKEN=$(curl -s -b cookies.txt http://localhost:5555/profile | grep -oP 'csrf-token.*content="\\K[^"]+')
      2. curl -s -b cookies.txt -X POST http://localhost:5555/change-profile -H "Content-Type: application/json" -H "X-CSRF-TOKEN: $CSRF_TOKEN" -d '{"name":"New","email":"new@x.com"}' -i | head -5 > .sisyphus/evidence/task-25-profile-post.txt
      3. Expect 200 or 422 (validation), NOT 500 or 404
    Expected Result: Contract intact
    Evidence: .sisyphus/evidence/task-25-profile-post.txt
  ```

  **Commit**: NO (groups with T24, T26, T27)

- [ ] 26. Rebuild Pages/dashboard.svelte with shadcn primitives

  **What to do**:
  - Read current `resources/js/Pages/dashboard.svelte` (238 LOC). Preserve:
    - `$props()` receiving paginated users + meta
    - `$derived()` computing `currentUser` (from inertiaPage.props.user) and time-based `greeting`
    - Quick-action links navigating to /users and /profile
  - Rebuild as:
    - `<Header group="dashboard" />` at top
    - Hero/welcome Card: greeting + user name
    - Stats strip: 3-4 Card widgets (total users, verified users, current user card) — use Lucide icons
    - Quick-actions grid: Button variants for "Manage Users", "Edit Profile"
    - Recent users list (if data supports it): compact Table or Avatar list
  - Target LOC: 180-220

  **Must NOT do**:
  - Do NOT add new endpoints (dashboard is read-only via inertia props)
  - Do NOT invent stats that are not derivable from props
  - Do NOT remove navigation to /users or /profile
  - Do NOT add client-side data fetching

  **Recommended Agent Profile**: `visual-engineering`, skills: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3
  - **Blocks**: T28
  - **Blocked By**: T9, T10, T22, T14

  **References**:
  - `resources/js/Pages/dashboard.svelte:1-238`
  - Backend: `GET /dashboard` returns same paginated user props as /users
  - `@lucide/svelte` icons: Users, UserCheck, CircleUser, Settings

  **Acceptance Criteria**:
  - [ ] `grep -E "import.*Card|import.*Button|import.*Badge" resources/js/Pages/dashboard.svelte` → ≥ 3 matches
  - [ ] `grep "Header" resources/js/Pages/dashboard.svelte` → ≥ 1 match
  - [ ] `grep -E "router.visit|href" resources/js/Pages/dashboard.svelte` → ≥ 2 matches (nav to /users, /profile)
  - [ ] `npx tsc --noEmit` → exit 0

  **QA Scenarios**:
  ```
  Scenario: Dashboard renders (authenticated)
    Tool: Bash
    Steps:
      1. npm run dev & ; sleep 8
      2. Login, save cookies
      3. curl -s -b cookies.txt http://localhost:5555/dashboard > .sisyphus/evidence/task-26-page.html
      4. Grep for Card markers and greeting text ("Welcome" or "Halo")
      5. kill %1
    Expected Result: Dashboard renders with shadcn widgets
    Evidence: .sisyphus/evidence/task-26-page.html

  Scenario: Unauthenticated redirect preserved
    Tool: Bash
    Steps:
      1. curl -sI http://localhost:5555/dashboard | head -1 > .sisyphus/evidence/task-26-auth.txt
      2. Expect 302
    Expected Result: Auth middleware still guards route
    Evidence: .sisyphus/evidence/task-26-auth.txt
  ```

  **Commit**: NO (groups with T24, T25, T27)

- [ ] 27. Rebuild Pages/landing.svelte with shadcn primitives (moderate refresh)

  **What to do**:
  - Read current `resources/js/Pages/landing.svelte` (447 LOC). Preserve sections:
    - Hero (gradient text, CTA buttons)
    - Feature showcase (cards with icons)
    - Google OAuth CTA
    - Decorative terminal mockup (can simplify with shadcn-style code block)
    - Testimonials / CTAs if present
  - Rebuild using shadcn primitives: `Card` for feature tiles, `Button` for CTAs, `Badge` for tags
  - Moderate refresh — consolidate visual language (less gradient heavy, more typographic/structural)
  - Preserve public/marketing voice and content
  - Keep navigation to /login, /register, /google/redirect intact
  - Include `<Header group="landing" />` (or no Header if current landing omits it — follow current behavior)
  - Target LOC: 320-400

  **Must NOT do**:
  - Do NOT remove any content sections
  - Do NOT change CTA destinations
  - Do NOT introduce new marketing copy / taglines that don't exist
  - Do NOT replace NaraIcon or change logo
  - Do NOT add animations requiring extra JS libs

  **Recommended Agent Profile**: `visual-engineering`, skills: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3
  - **Blocks**: T28
  - **Blocked By**: T9, T10, T22, T14

  **References**:
  - `resources/js/Pages/landing.svelte:1-447`
  - Navigation targets: `/login`, `/register`, `/google/redirect`

  **Acceptance Criteria**:
  - [ ] `grep -E "import.*Card|import.*Button|import.*Badge" resources/js/Pages/landing.svelte` → ≥ 3 matches
  - [ ] `grep -E "/login|/register|/google/redirect" resources/js/Pages/landing.svelte` → ≥ 3 matches (CTAs preserved)
  - [ ] LOC within 320-400 range
  - [ ] `npx tsc --noEmit` → exit 0; `npm run build` → exit 0

  **QA Scenarios**:
  ```
  Scenario: Landing page renders publicly
    Tool: Bash
    Steps:
      1. npm run dev & ; sleep 8
      2. curl -s http://localhost:5555/ > .sisyphus/evidence/task-27-page.html
      3. Assert 200 response
      4. Grep for Card markers, Button markers, CTA links
      5. kill %1
    Expected Result: Landing renders with moderate shadcn refresh
    Evidence: .sisyphus/evidence/task-27-page.html

  Scenario: CTAs navigate correctly
    Tool: Bash
    Steps:
      1. Inspect landing HTML: grep -c "href=\"/login\"\\|href=\"/register\"\\|href=\"/google/redirect\"" .sisyphus/evidence/task-27-page.html > .sisyphus/evidence/task-27-ctas.txt
      2. Assert ≥ 3
    Expected Result: All CTAs present
    Evidence: .sisyphus/evidence/task-27-ctas.txt
  ```

  **Commit**: YES (ends Wave 3)
  - Message: `refactor(pages): rebuild users, profile, dashboard, landing with shadcn primitives`
  - Files: `resources/js/Pages/users.svelte`, `.../profile.svelte`, `.../dashboard.svelte`, `.../landing.svelte`
  - Pre-commit: `npx tsc --noEmit && npm run build`

- [ ] 28. Remove Components/helper.ts shim; migrate remaining imports to $lib/*

  **What to do**:
  - Run: `grep -rn "from ['\"].*Components/helper['\"]" resources/js --include="*.svelte" --include="*.ts"`
  - For each match: rewrite the import to point to the specific `$lib/*` module:
    - `import { api } from '../Components/helper'` → `import { api } from '$lib/api'`
    - `import { buildCSRFHeaders } from '../Components/helper'` → `import { buildCSRFHeaders } from '$lib/csrf'`
    - `import { Toast } from '../Components/helper'` → `import { Toast } from '$lib/toast'`
    - `import { debounce } from '../Components/helper'` → `import { debounce } from '$lib/utils/debounce'`
    - `import { generatePassword } from '../Components/helper'` → `import { generatePassword } from '$lib/utils/password'`
    - `import { clickOutside } from '../Components/helper'` → `import { clickOutside } from '$lib/hooks/click-outside'`
  - After ALL imports migrated: `rm resources/js/Components/helper.ts`
  - Verify: `grep -r "Components/helper" resources/js` returns NO matches

  **Must NOT do**:
  - Do NOT delete `helper.ts` before migrating all consumer imports
  - Do NOT merge multiple imports into one line if the original had them split
  - Do NOT leave any broken imports

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Codebase-wide refactor touching multiple files, careful coordination
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: NO — must run after ALL page migrations (T18-T27)
  - **Parallel Group**: Wave 4, sequential
  - **Blocks**: T30
  - **Blocked By**: T18-T27

  **References**:
  - `resources/js/Components/helper.ts` (shim from T7)
  - `resources/js/lib/{api,csrf,toast}.ts`, `resources/js/lib/utils/*`, `resources/js/lib/hooks/*`

  **Acceptance Criteria**:
  - [ ] `grep -r "Components/helper" resources/js` → no matches
  - [ ] `test -f resources/js/Components/helper.ts` → exit 1 (file removed)
  - [ ] `grep -rc "from .\\$lib/" resources/js --include="*.svelte" --include="*.ts" | grep -v ":0$" | wc -l` → ≥ 10 files using new $lib imports
  - [ ] `npx tsc --noEmit` → exit 0
  - [ ] `npm run build` → exit 0
  - [ ] `npm test` → all tests pass

  **QA Scenarios**:
  ```
  Scenario: No orphan imports
    Tool: Bash
    Steps:
      1. Run: grep -rn "Components/helper" resources/js > .sisyphus/evidence/task-28-orphans.txt
      2. Assert file is empty
    Expected Result: Zero references to old path
    Evidence: .sisyphus/evidence/task-28-orphans.txt

  Scenario: Helper.ts fully removed
    Tool: Bash
    Steps:
      1. Run: ls -la resources/js/Components/helper.ts 2>&1 | tee .sisyphus/evidence/task-28-removal.txt
      2. Assert output contains "No such file"
    Expected Result: File does not exist
    Evidence: .sisyphus/evidence/task-28-removal.txt
  ```

  **Commit**: NO (groups with T29 as "chore(cleanup)")

- [ ] 29. Purge dead @layer components rules from index.css

  **What to do**:
  - Read `resources/js/index.css` — identify `@layer components` block
  - For each rule (`.btn-primary`, `.btn-secondary`, `.card`, `.nav-link`, `.gradient-text`, `.card-hover`, `.mobile-nav-link`, `.btn-accent`, `.btn-danger`, `.btn-warning`, `.btn-info`, `.gradient-text-accent`, `.gradient-text-info`, `.side-menu`, `.bg-surface`, `.bg-surface-card`):
    - Grep usage: `grep -rE "class=\".*${rule}" resources/js --include="*.svelte"`
    - If NO matches: delete the rule
    - If matches exist: KEEP the rule (document in evidence which rules are still used)
  - Preserve: `@import` statements, `@tailwind` directives, `html font-family`, `body::-webkit-scrollbar`, `@layer base` CSS variables (from T5 — MUST STAY)
  - Target: reduce file from 136 LOC to ~50-70 LOC if most utilities are swapped

  **Must NOT do**:
  - Do NOT remove `@layer base { :root { ... } .dark { ... } }` — these are shadcn CSS variables
  - Do NOT remove `@import url('https://rsms.me/inter/inter.css')` or Playfair font imports
  - Do NOT remove `html` or scrollbar rules
  - Do NOT delete rules that still have usages (verify each)

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Careful CSS pruning with grep-verification per rule
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES (with T28 — different files)
  - **Parallel Group**: Wave 4
  - **Blocks**: T30
  - **Blocked By**: T18-T27 (all pages migrated)

  **References**:
  - `resources/js/index.css:26-136` — @layer components block (candidates for removal)
  - `resources/js/index.css:7-24` — @layer base (preserve)
  - T5 added CSS variables block in @layer base (preserve)

  **Acceptance Criteria**:
  - [ ] `grep -cE "\\.btn-primary \\{|\\.nav-link \\{|\\.card-hover \\{" resources/js/index.css` → 0 (or preserved ONLY if still used)
  - [ ] `grep ":root {" resources/js/index.css` → ≥ 1 match (CSS vars preserved)
  - [ ] `grep "--primary:" resources/js/index.css` → ≥ 1 match
  - [ ] `grep "@tailwind" resources/js/index.css` → 3 matches (base, components, utilities)
  - [ ] `grep "rsms.me/inter" resources/js/index.css` → 1 match (Inter font import)
  - [ ] `npm run build` → exit 0

  **QA Scenarios**:
  ```
  Scenario: Dead rules pruned, live rules preserved
    Tool: Bash
    Steps:
      1. For each removed rule, grep across resources/js/ for any class usage — output to report
      2. Run: for rule in btn-primary btn-secondary nav-link card-hover gradient-text; do echo "$rule: $(grep -rc "class=\".*$rule" resources/js/ --include='*.svelte' | awk -F: '{s+=$NF} END {print s}')"; done > .sisyphus/evidence/task-29-usage-audit.txt
      3. Verify that every rule in index.css has zero usage if it was removed
    Expected Result: No dead CSS, no broken class references
    Evidence: .sisyphus/evidence/task-29-usage-audit.txt

  Scenario: CSS variables preserved
    Tool: Bash
    Steps:
      1. Run: grep -cE "--primary:|--destructive:|--ring:|--background:|--foreground:" resources/js/index.css > .sisyphus/evidence/task-29-vars.txt
      2. Assert count ≥ 10
    Expected Result: Shadcn tokens intact after cleanup
    Evidence: .sisyphus/evidence/task-29-vars.txt
  ```

  **Commit**: YES
  - Message: `chore(cleanup): remove helper.ts shim and dead @layer components utilities`
  - Files: `resources/js/Components/helper.ts` (deletion), `resources/js/index.css`, and any consumer file from T28 import rewrites
  - Pre-commit: `npx tsc --noEmit && npm run build && npm test`

- [ ] 30. Full green check — build + tsc + vitest + lint all passing

  **What to do**:
  - Run full verification matrix:
    - `npx tsc --noEmit` → must exit 0
    - `node nara lint` → must exit 0
    - `npm test` (vitest) → must pass all suites
    - `npm run build` → must exit 0 (dist/ populated)
  - Capture output of each to evidence files
  - Verify dev server can start: `npm run dev` (background), wait 10s, curl /, kill
  - If any fails: fix and re-run (this is a quality gate task)

  **Must NOT do**:
  - Do NOT commit if any check fails
  - Do NOT skip any check
  - Do NOT `--force` past failures

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Deterministic command execution with pass/fail gate
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 4, sequential after T28, T29
  - **Blocks**: T31
  - **Blocked By**: T28, T29

  **References**:
  - `package.json:11-18` — scripts: dev, build, start, test, lint, typecheck

  **Acceptance Criteria**:
  - [ ] `npx tsc --noEmit` exit 0
  - [ ] `node nara lint` exit 0
  - [ ] `npm test` all suites pass
  - [ ] `npm run build` exit 0
  - [ ] `npm run dev` starts and `curl -sI http://localhost:5555/` returns 200

  **QA Scenarios**:
  ```
  Scenario: All gates green
    Tool: Bash
    Steps:
      1. Run: npx tsc --noEmit 2>&1 | tee .sisyphus/evidence/task-30-tsc.txt; echo "TSC exit: $?" >> .sisyphus/evidence/task-30-tsc.txt
      2. Run: node nara lint 2>&1 | tee .sisyphus/evidence/task-30-lint.txt; echo "LINT exit: $?" >> .sisyphus/evidence/task-30-lint.txt
      3. Run: npm test 2>&1 | tee .sisyphus/evidence/task-30-test.txt
      4. Run: npm run build 2>&1 | tee .sisyphus/evidence/task-30-build.txt
      5. Assert all "exit 0"
    Expected Result: All green
    Evidence: .sisyphus/evidence/task-30-*.txt

  Scenario: Dev server boots
    Tool: Bash
    Steps:
      1. npm run dev & ; sleep 10
      2. curl -sI http://localhost:5555/ > .sisyphus/evidence/task-30-dev.txt
      3. kill %1
      4. Assert "200" or "302" in response
    Expected Result: Dev server functional post-migration
    Evidence: .sisyphus/evidence/task-30-dev.txt
  ```

  **Commit**: NO (T31 handles final commit)

- [ ] 31. Commit strategy execution — atomic commits per logical group

  **What to do**:
  - Review git status — all changes should be staged from prior task commits
  - Ensure linear history: each wave's commit exists as listed in Commit Strategy section
  - Do NOT introduce new changes in this task — just verify all prior commits were made correctly
  - If any wave's commit was skipped: create it now with the appropriate message
  - Final commit (if any outstanding): `chore(verify): green check — build + tsc + tests + lint all passing`

  **Must NOT do**:
  - Do NOT force-push
  - Do NOT amend already-pushed commits
  - Do NOT squash (atomic history requested)
  - Do NOT use `git rebase -i` (no interactive)

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Git verification and possibly one final commit
  - **Skills**: [`git-master`] — git workflow specialist
    - git-master: required for careful git operations respecting the repo's conventions

  **Parallelization**:
  - **Can Run In Parallel**: NO — final task
  - **Parallel Group**: Wave 4, sequential after T30
  - **Blocks**: F1-F4 (final verification)
  - **Blocked By**: T30

  **References**:
  - Commit Strategy section of this plan
  - Repo convention from AGENTS.md: `type(scope): desc`

  **Acceptance Criteria**:
  - [ ] `git log --oneline` shows ≥ 5 atomic commits for this work (one per logical group)
  - [ ] `git status` shows "nothing to commit, working tree clean"
  - [ ] Each commit message matches Commit Strategy format

  **QA Scenarios**:
  ```
  Scenario: Clean git state with atomic commits
    Tool: Bash
    Steps:
      1. Run: git log --oneline -20 > .sisyphus/evidence/task-31-log.txt
      2. Run: git status > .sisyphus/evidence/task-31-status.txt
      3. Grep log for expected commit prefixes: grep -cE "^[a-f0-9]+ (chore|feat|refactor)" .sisyphus/evidence/task-31-log.txt
      4. Assert count ≥ 5
    Expected Result: Atomic commits present, tree clean
    Evidence: .sisyphus/evidence/task-31-log.txt, .sisyphus/evidence/task-31-status.txt
  ```

  **Commit**: N/A (this IS the commit verification task)

---

## Final Verification Wave (MANDATORY — after ALL implementation tasks)

> 4 review agents run in PARALLEL. ALL must APPROVE. Present consolidated results to user; get explicit "okay" before completing.

- [ ] F1. **Plan Compliance Audit** — `oracle`
  Read the plan end-to-end. For each "Must Have": verify implementation exists (read file, run command, curl endpoint). For each "Must NOT Have": search codebase for forbidden patterns — reject with file:line if found. Check evidence files exist in .sisyphus/evidence/. Compare deliverables against plan.
  Output: `Must Have [N/N] | Must NOT Have [N/N] | Tasks [N/N] | VERDICT: APPROVE/REJECT`

- [ ] F2. **Code Quality Review** — `unspecified-high`
  Run `npx tsc --noEmit` + `node nara lint` + `npm run build` + `npm test`. Review all changed files for: `as any`/`@ts-ignore`, empty catches, `console.log` in prod code, commented-out code, unused imports. Check AI slop: excessive comments, over-abstraction, generic names.
  Output: `Build [PASS/FAIL] | TSC [PASS/FAIL] | Tests [N pass/N fail] | Files [N clean/N issues] | VERDICT`

- [ ] F3. **Real Functional QA (no browser)** — `unspecified-high`
  Start dev server (`npm run dev`), wait for both Vite + HyperExpress ready. Execute EVERY QA scenario from EVERY task — `curl` against live server, capture HTML/JSON evidence. Test cross-task integration: login → dashboard → users → create → update → delete → logout flow via curl session with cookies. Edge cases: unauthenticated access → 302, invalid login → error cookie. Save to `.sisyphus/evidence/final-qa/`.
  Output: `Scenarios [N/N pass] | Integration [N/N] | Edge Cases [N tested] | VERDICT`

- [ ] F4. **Scope Fidelity Check** — `deep`
  For each task: read "What to do", read actual diff (`git log`/`git diff`). Verify 1:1 — everything in spec was built, nothing beyond spec was built (no creep). Check "Must NOT do" compliance strictly (especially: no backend changes, no Playwright, no new pages, no removed color scales). Detect cross-task contamination: Task N touching Task M's files. Flag unaccounted changes.
  Output: `Tasks [N/N compliant] | Contamination [CLEAN/N issues] | Unaccounted [CLEAN/N files] | VERDICT`

---

## Commit Strategy

Atomic commits per logical group (executed in T31):

1. `chore(deps): add shadcn-svelte dependencies (bits-ui, lucide, mode-watcher, etc.)` — T1
2. `feat(config): configure shadcn-svelte for resources/js/lib layout` — T2, T3, T4, T5, T6
3. `refactor(lib): split helper.ts into resources/js/lib/* modules + unit tests` — T7, T8
4. `feat(ui): install shadcn-svelte primitive components (20 total)` — T9, T10, T11, T12, T13
5. `feat(app): wire Toaster and ModeWatcher into Inertia entry` — T14
6. `refactor(components): rebuild shared components with shadcn primitives` — T15, T16, T17
7. `refactor(auth): rebuild auth pages with shadcn primitives` — T18, T19, T20, T21
8. `refactor(components): rebuild Header with NavigationMenu/Sheet/DropdownMenu` — T22
9. `refactor(components): rebuild UserModal with shadcn Dialog + forms` — T23
10. `refactor(pages): rebuild users page with shadcn primitives` — T24
11. `refactor(pages): rebuild profile, dashboard, landing pages` — T25, T26, T27
12. `chore(cleanup): remove helper.ts shim + dead @layer components from index.css` — T28, T29
13. `chore(verify): green check — build + tsc + tests + lint all passing` — T30

Pre-commit gate: `npx tsc --noEmit && npm test && npm run build` must pass.

---

## Success Criteria

### Verification Commands

```bash
# Build integrity
npx tsc --noEmit                                      # Expected: exit 0, no errors
npm run build                                         # Expected: exit 0, dist/ populated
node nara lint                                        # Expected: exit 0

# Test integrity
npm test                                              # Expected: all Vitest suites PASS

# Preservation checks (MUST pass)
grep -rE "bg-primary-(50|100|500|600)" resources/js | wc -l   # Expected: > 0 (utility preserved)
grep -rE "from ['\"]\\\$lib" resources/js | wc -l             # Expected: >= 15 (new lib imports)
grep -rE "@core" app/ | wc -l                                  # Expected: > 0 (backend untouched)

# Cleanup checks (MUST pass)
grep -r "Components/helper" resources/js                      # Expected: no matches
grep -rE "\.btn-primary|\.nav-link" resources/js/index.css   # Expected: no matches
grep -rE "class=.*(btn-primary|nav-link|card-hover)" resources/js | wc -l  # Expected: 0

# Anti-patterns absent
grep -rE "playwright" package.json node_modules/.package-lock.json 2>/dev/null  # Expected: no deps
grep -rE "as any|@ts-ignore|@ts-nocheck" resources/js --include="*.svelte" --include="*.ts" | wc -l  # Expected: 0

# Runtime checks (dev server running)
curl -sI http://localhost:5555/ | head -1                     # Expected: 200 OK
curl -sI http://localhost:5555/dashboard | head -1            # Expected: 302 (auth redirect)
curl -s http://localhost:5555/login | grep -c "data-inertia"  # Expected: > 0
```

### Final Checklist

- [ ] All "Must Have" items present and verified
- [ ] All "Must NOT Have" items absent and verified
- [ ] All 31 implementation tasks complete with evidence files
- [ ] All 4 final verification tasks (F1-F4) APPROVED
- [ ] User has given explicit "okay" after reviewing F1-F4 results
