# Decisions — shadcn-svelte-overhaul

## Architecture
- Keep components.json at project root
- $lib alias points to resources/js/lib (non-SvelteKit project)
- Components/helper.ts stays as re-export shim through Wave 3, removed in T28
- Toast() signature preserved: Toast(type: string, message: string)

## Color Strategy  
- Bridge --primary to emerald-600 HSL (160.1 84.1% 39.4%)
- Tailwind primary.DEFAULT = hsl(var(--primary)) — added alongside 50..950 scale
- bg-primary works via CSS var; bg-primary-500 works via literal hex — BOTH work

## Test Strategy
- Vitest only, environment: jsdom
- Tests for lib/* utility modules only (NO .svelte component tests)
- NO Playwright, NO @testing-library/svelte

## Wave Sequence
- Wave 1: T1-T6 parallel, T7 sequential after T3+T6, T8 sequential after T7
- Wave 2: T9-T13 parallel (after Wave 1), T14 sequential after T7+T13, T15 after T1+T9+T14, T16 after T13, T17 after T3
- Wave 3: T18-T27 all parallel (after Wave 2 complete)
- Wave 4: T28+T29 parallel, T30 after both, T31 after T30
