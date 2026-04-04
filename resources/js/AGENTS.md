# resources/js - Svelte 5 Frontend

## OVERVIEW

Svelte 5 frontend powered by Inertia.js for server-side rendering with client-side hydration.

## STRUCTURE

```
resources/js/
├── Components/       # Reusable UI components (Header, UserModal, Can, Pagination, etc.)
├── Pages/            # Route pages (dashboard, landing, profile, users, auth/*)
├── types/           # TypeScript definitions and generated types
└── app.ts           # Inertia app initialization
```

## FRAMEWORK

- **Svelte 5** with runes: `$state`, `$derived`, `$effect` for reactivity
- **Inertia.js** adapter for SSR + client navigation via `link()` helper
- **TypeScript** for type safety

## CONVENTIONS

- Components use `.svelte` extension with `<script lang="ts">`
- Use `link()` from Inertia for internal navigation (not `<a href>`)
- State management via `$state()` runes, avoid legacy stores
- Authorization component `<Can />` wraps gated UI sections
- Dark mode toggle: `<DarkModeToggle />` persists to localStorage
- Types in `types/index.ts` and auto-generated `types/generated.ts`