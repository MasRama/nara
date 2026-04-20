# Authorization

## Overview

Role-Based Access Control (RBAC) via Gate abilities and Policies. Controls what authenticated users can do, beyond just "logged in or not."

## Structure

| File | Purpose |
|------|---------|
| `Gate.ts` | Singleton gate, registers and checks abilities |
| `Policy.ts` | Abstract base class for resource policies |
| `index.ts` | Barrel export |

## Ability Pattern (simple checks)

```typescript
import { gate } from "@authorization";

// Define ability
gate.define("publish-post", (user: User, post: Post) => {
  return user.id === post.author_id || user.roles.includes("admin");
});

// Check ability
const canPublish = await gate.allows(user, "publish-post", post);
```

## Policy Pattern (resource-based checks)

```typescript
import { Policy } from "@authorization";

export class PostPolicy extends Policy {
  // before() runs first — return true to bypass all checks (admin shortcut)
  async before(user: User): Promise<boolean | null> {
    const isAdmin = await User.isAdmin(user.id);
    return isAdmin ? true : null; // null = continue to specific check
  }

  async update(user: User, post: Post): Promise<boolean> {
    return user.id === post.author_id;
  }

  async delete(user: User, post: Post): Promise<boolean> {
    return user.id === post.author_id;
  }
}

// Register policy
gate.policy("Post", PostPolicy);
```

## Usage in Controllers

```typescript
// Via BaseController helper (recommended):
await this.authorize(req, "publish-post", post);  // throws ForbiddenError if denied

// Via helpers:
import { can, cannot, authorize } from "@helpers/authorization";

if (await can(req.user, "edit-post", post)) {
  // allow
}

await authorize(req.user, "delete-post", post); // throws ForbiddenError
```

## Policy Method Invocation

When ability name contains `:` (e.g., `"Post:update"`), Gate resolves the policy:
```typescript
await gate.allows(user, "Post:update", post); // calls PostPolicy.update(user, post)
```

## Conventions

- Abilities: simple boolean functions registered on gate
- Policies: class for resource-specific checks with `before()` admin bypass
- Policy filename: `{Resource}Policy.ts`
- Register policies in bootstrap or service provider
- Always pass full user object (null/undefined = unauthorized)
- `authorize()` throws `ForbiddenError` — use in controllers, not templates
- `can()` returns boolean — use in Svelte `<Can>` checks
