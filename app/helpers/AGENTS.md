# Helpers

## Overview

Thin utility wrappers over core systems. Provides convenient shorthand functions used across controllers, services, and events.

## Structure

| File | Exports | Purpose |
|------|---------|---------|
| `events.ts` | `event`, `on`, `once`, `off` | Shortcuts for EventDispatcher |
| `authorization.ts` | `can`, `cannot`, `authorize`, `authorizeAndReturn` | Shortcuts for Gate |

## events.ts

```typescript
import { event, on, once, off } from "@helpers/events";

// Dispatch an event
await event(new UserRegistered({ user }));

// Register a persistent listener
const unsubscribe = on(UserRegistered, async (e) => {
  await sendWelcomeEmail(e.payload.user);
});

// Register a one-time listener
once(UserRegistered, (e) => Logger.info("First registration", e.payload));

// Remove a specific listener
off(UserRegistered, handler);
```

## authorization.ts

```typescript
import { can, cannot, authorize, authorizeAndReturn } from "@helpers/authorization";

// Boolean check (does not throw)
if (await can(user, "edit-post", post)) { ... }
if (await cannot(user, "delete-post", post)) { ... }

// Throws ForbiddenError if denied (use in controllers)
await authorize(user, "publish-post", post);

// Throws + narrows type (user guaranteed non-null after call)
const authedUser = await authorizeAndReturn(user, "create-post");
// authedUser: User (not null)
```

## Conventions

- Use `@helpers/events` alias — never import `EventDispatcher` directly
- Use `@helpers/authorization` alias — never import `Gate` directly
- `authorize()` throws `ForbiddenError` on denial — for hard enforcement in controllers
- `authorizeAndReturn()` throws `ForbiddenError` AND narrows `user` type from `User | undefined` to `User` — use when you need the user object guaranteed non-null after the check
- `can()` / `cannot()` return `Promise<boolean>` — for conditional logic (if/else), NOT for enforcement
- Inside a controller method, prefer `this.authorize(req, 'ability', resource)` — shorthand that pulls user from request automatically
- `event()` is the only way to dispatch — never instantiate `EventDispatcher` directly
