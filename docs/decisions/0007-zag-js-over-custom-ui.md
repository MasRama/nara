# ADR 0007: Zag JS over custom UI primitives

Date: 2025-01-15
Status: Accepted

## Context

Interactive UI components (dialog, menu, switch, tabs, pagination) need:
- Accessibility (ARIA, keyboard navigation, focus management)
- State management (open/close, selected index, etc.)
- Framework-agnostic logic (so it works with Svelte 5)

Building these from scratch is error-prone and time-consuming. AI-generated accessibility code is often incomplete.

## Decision

Use Zag JS (`@zag-js/*`) for headless UI primitives:
- Framework-agnostic state machines for UI components
- Svelte adapter via `@zag-js/svelte`
- Full accessibility built-in (ARIA, keyboard, focus)
- Styled with Tailwind — Zag handles behavior, we handle styling

## Consequences

Positive:
- Accessibility "just works" — no need for AI to remember ARIA patterns
- AI focuses on styling + behavior, not accessibility plumbing
- Framework-agnostic — can switch to React/Vue without learning new components
- Smaller than full component libraries (only import what you use)

Negative:
- Less popular than Headless UI — fewer community resources
- API is machine-oriented (connect/getProps) — slightly more verbose than Headless UI
- AI training data is thinner than Headless UI — but Zag's API is consistent and learnable

## Alternatives considered

- **Headless UI (@headlessui/svelte)** — popular, but Svelte support is limited and the project is less maintained.
- **shadcn-svelte** — built on Headless UI, good but locks into a specific styling system.
- **Custom components** — full control, but accessibility is hard and AI gets it wrong often.
- **Melt UI** — similar to Zag (headless), but less mature.
