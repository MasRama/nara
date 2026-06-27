# ADR 0002: Functions over classes

Date: 2025-01-15
Status: Accepted

## Context

TypeScript supports both OOP (classes) and functional programming (functions). AI code generators produce cleaner, more consistent code with functions because:
- Functions have one pattern (export const = arrow function)
- Classes have multiple patterns (constructor, methods, getters, setters, inheritance, decorators)
- Functions compose naturally (pass as arguments, return from functions)
- Classes add ceremony (`this.`, `new`, `extends`) without adding value in a CRUD app

## Decision

Use functions exclusively. No `class` declarations in `app/handlers/`, `app/queries/`, `app/validators/`, `app/middlewares/`.

Exception: `app/core/errors.ts` uses a class for `NaraError` because it needs `instanceof` checks and extends `Error`.

## Consequences

Positive:
- Consistent code style — every export is `export const x = (...) => {...}`
- AI generates uniform code — no "should this be a class or function?" decision
- Easier to test — functions are pure, no setup/teardown of class instances
- Smaller bundle size — no class metadata

Negative:
- No inheritance (acceptable — composition over inheritance is preferred anyway)
- No method chaining on custom types (acceptable — use pipe-style function composition)

## Alternatives considered

- **Classes for services** — traditional OOP approach. Adds `this` binding issues, constructor injection complexity, and makes AI-generated code inconsistent (some files use classes, some use functions).
- **Mix** — worst of both worlds. AI must decide which pattern to use for each file, leading to inconsistency.
