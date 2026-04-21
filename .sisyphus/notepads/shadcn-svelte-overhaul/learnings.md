# Learnings — shadcn-svelte-overhaul

## Project Conventions
- TypeScript strict mode
- Path aliases: @core, @models, @services (backend); $lib → resources/js/lib (frontend new)
- Svelte 5 runes: $props(), $state(), $derived(), $effect()
- Inertia.js for routing (router.visit, router.post, res.inertia())
- Port 5555 (server), 5173 (vite)
- 2-space indent

## Package Versions
- svelte: ^5.41.3
- tailwindcss: ^3.4.14 (DO NOT upgrade to v4)
- vitest: ^4.1.4
- @types/node already installed: ^22.7.9

## Key File Paths
- vite config: vite.config.mjs (NOT vite.config.ts)
- index.css: resources/js/index.css
- app entry: resources/js/app.js (NOT app.ts)
- shadcn components target: resources/js/lib/components/ui/
- test script: vitest run (NOT jest)
- lint: node nara lint OR npx tsc --noEmit

## Critical Decisions
- $lib alias → resources/js/lib (NOT src/lib - this is NOT SvelteKit)
- Primary color: emerald-600 HSL = 160.1 84.1% 39.4%
- baseColor in components.json: "slate" (shadcn neutral palette, we bridge primary separately)
- DarkMode: mode-watcher (replaces localStorage manual logic)
- Toast: sonner via svelte-sonner (installed by shadcn sonner component)
