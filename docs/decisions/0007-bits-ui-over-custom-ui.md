# ADR 0007: Bits UI over custom UI primitives

Date: 2025-01-15 (rev. 2026-08-17)
Status: Accepted

## Context

Interactive UI components (dialog, menu, switch, tabs) need:
- Accessibility (ARIA, keyboard navigation, focus management)
- State management (open/close, selected index, etc.)
- Svelte 5 compatibility (runes)

Building these from scratch is error-prone and time-consuming. AI-generated accessibility code is often incomplete.

The original decision (2025-01-15) chose Zag JS (`@zag-js/*`). After using it in production components, the costs became clear:

- The Svelte adapter is the weakest of Zag's adapters — thinnest docs, fewest examples, updates lag the React adapter.
- The wiring API (`useMachine` + `normalizeProps` + `api.get*Props()`) is React-flavored and verbose in Svelte.
- AI agents (the primary consumers of this starter kit) know the Svelte-native headless ecosystem far better than Zag's machine API — more convention drift and hallucination risk on complex primitives.

shadcn-svelte was considered as a replacement but rejected: it is a full design system (~45 component files + styling layer) which bloats the repo — the opposite of Nara's minimal-code philosophy.

## Decision

Use **Bits UI** (`bits-ui`) for headless UI primitives:

- Svelte 5 native (runes), component-based API (`Dialog.Root`, `DropdownMenu.Content`, `Switch.Thumb`, `Tabs.Trigger`) — no machine wiring.
- Zero styling opinions — behavior + ARIA only, styled with Tailwind.
- Full accessibility built-in (ARIA, keyboard, focus trap, scroll lock, escape handling).
- Active maintenance and the largest Svelte headless community; also the foundation shadcn-svelte builds on (escape hatch if a full design system is ever wanted).

## Consequences

Positive:
- Accessibility "just works" — no need for AI to remember ARIA patterns
- Svelte-idiomatic code: controlled state via props (`open`/`onOpenChange`, `checked`/`onCheckedChange`, `value`/`onValueChange`) or `bind:`
- More community examples + agent training data than Zag's Svelte adapter
- Repo stays lean: only the primitives in use are imported (`Dialog`, `DropdownMenu`, `Switch`, `Tabs`)

Negative:
- Component API slightly more markup per primitive than Zag's prop-spreading (explicit `Portal`/`Overlay`/`Content` nesting)
- Loses Zag's framework-agnostic logic (irrelevant — Nara is Svelte-only by ADR 0003)

## Alternatives considered

- **Zag JS (original choice)** — functional, but the Svelte adapter costs (docs, examples, API ergonomics) remain.
- **shadcn-svelte** — full design system; 45+ files and a styling layer. Heavy for a minimal starter kit; rejected.
- **Melt UI** — the original Svelte headless; its runes rewrite was only recently open-sourced with docs still WIP. Bits UI is the more mature choice.
- **Kobalte** — solid a11y but small community and less momentum.
- **Custom components** — full control, but accessibility is hard and AI gets it wrong often.
