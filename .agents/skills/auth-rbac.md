---
trigger: Adding auth guards, permission checks, role management, or session handling
status: active-v3
---

# Auth & RBAC (v3)

## When to use

Load this skill when changing the auth Feature, session checks, role management, permission checks, or browser authorization UI.

## Ownership

Authentication and authorization are owned by `src/features/auth/`:

```text
src/features/auth/
├── contract.ts
├── index.ts
├── server/
│   ├── routes.ts
│   ├── service.ts
│   ├── repository.ts
│   └── access.ts
└── web/
    └── client.ts
```

Use public exports from `src/features/auth/index.ts` when another Feature needs an auth capability. Do not import `server/` internals from browser code or another Feature.

## Route guard

The server is authoritative. Resolve the session from the auth Feature and reject unauthenticated requests before using user data:

```typescript
import { getCookie } from 'hono/cookie';
import type { Context } from 'hono';
import { getCurrentUser, SESSION_COOKIE_NAME } from '@features/auth';

export function requireSession(context: Context) {
  const user = getCurrentUser(getCookie(context, SESSION_COOKIE_NAME));
  if (!user) {
    return context.json(
      { success: false as const, message: 'Unauthorized', code: 'UNAUTHORIZED' },
      401,
    );
  }
  return user;
}
```

For permission-protected routes, check admin access or the specific permission after resolving the session:

```typescript
const user = getCurrentUser(getCookie(context, SESSION_COOKIE_NAME));
if (!user) return unauthorized(context);
if (!isAdmin(user.id) && !hasPermission(user.id, 'users.edit')) {
  return forbidden(context);
}
```

Keep route-specific response helpers local to the Feature when they are repeated. Do not move auth logic into a global technical layer.

## Permission slug convention

Permissions follow `<resource>.<action>`:

| Slug | Meaning |
|---|---|
| `users.view` | View user list |
| `users.create` | Create a user |
| `users.edit` | Edit a user |
| `users.delete` | Delete a user |
| `roles.view` | View roles |
| `roles.create` | Create a role |
| `roles.edit` | Edit a role |
| `roles.delete` | Delete a role |

When adding a capability, define its permission data with the owning Feature and enforce it in the server route.

## Admin bypass

`isAdmin(userId)` checks the `admin` role. Use this order:

1. resolve the session user
2. allow the admin bypass where the route requires it
3. check the specific permission with `hasPermission(userId, '<resource>.<action>')`

Never use a client-provided role or permission list as the security decision.

## Frontend permission gating

Vue pages may hide controls using browser-safe user data, but this is only UX gating. The server route must repeat the authorization check.

```vue
<script setup lang="ts">
interface CurrentUser {
  roles?: string[];
  permissions?: string[];
}

const props = defineProps<{ user?: CurrentUser }>();

function hasPermission(slug: string): boolean {
  if (!props.user) return false;
  if (props.user.roles?.includes('admin')) return true;
  return props.user.permissions?.includes(slug) ?? false;
}
</script>

<template>
  <button v-if="hasPermission('users.create')" type="button">Add user</button>
</template>
```

## Password and session handling

Use `hashPassword()` from the auth Feature public boundary. Password verification and session creation remain inside the auth Feature service. Session cookies must remain HTTP-only, use the configured expiry, and use secure flags in production.

## Do / Don't

- **Do** resolve the session before reading user data.
- **Do** enforce permissions in Hono routes, not only in Vue.
- **Do** use the `<resource>.<action>` permission convention.
- **Do** use `src/features/auth` public exports across Feature boundaries.
- **Do** keep password fields out of API responses and browser page props.
- **Don't** import another Feature's `server/` internals from web code.
- **Don't** create session logic in unrelated Features.
- **Don't** trust browser-provided roles or permissions.
- **Don't** use a second auth mechanism or JWT without an explicit specification.
