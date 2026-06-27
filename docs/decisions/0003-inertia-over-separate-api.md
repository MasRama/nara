# ADR 0003: Inertia.js over separate API + SPA

Date: 2025-01-15
Status: Accepted

## Context

Traditional SPA architecture requires:
1. Backend API (JSON endpoints)
2. Frontend SPA (React/Vue/Svelte)
3. State management (Redux/Zustand/Pinia)
4. API client layer (fetch/axios + error handling + loading states)
5. Routing on both sides (API routes + frontend routes)

This doubles the surface area AI must understand. For a starter kit, the complexity is not justified.

## Decision

Use Inertia.js — a protocol that lets Svelte pages receive server data as props, without building a separate API. The backend renders Inertia responses (`res.inertia('pageName', { data })`), the frontend receives them as `$props()`.

For data-only operations (CRUD mutations, list fetching), use separate JSON endpoints with `axios` wrapped in `api()`.

## Consequences

Positive:
- One routing layer (backend routes define both URL and page)
- No client-side state management — server is source of truth
- AI writes one handler that serves both page render and data
- Smaller frontend bundle — no router, no state library

Negative:
- Full page reloads for navigation (mitigated by Inertia's partial reload + `preserveState`)
- Not suitable for highly interactive apps (real-time, offline) — acceptable for admin/CMS starter kit
- Coupled to backend framework (can't swap frontend without changing backend responses)

## Alternatives considered

- **Separate API + Svelte SPA** — more flexible, but doubles the code AI must write and maintain. Every feature needs: API route + API client + frontend page + state management.
- **HTMX** — server-rendered HTML with hypermedia controls. Simpler than Inertia, but no Svelte component model. AI must learn HTMX attributes instead of Svelte components.
- **Next.js / SvelteKit** — full-stack frameworks with built-in SSR. Locks you into their routing, deployment, and conventions. Nara uses ultimate-express, not Node.js, so these don't apply.
