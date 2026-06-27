---
authority: canon
owner: masrama
last_verified: 2026-06-28
trigger: Adding auth guards, permission checks, role management, or session handling
---

# Auth & RBAC

> **Authority:** canon — current source of truth for authentication and authorization patterns.

## When to use

Any handler that needs to check if a user is logged in, has a role, or has a permission.

## Auth Guard (in handler)

```typescript
import { jsonError } from '@core';
import { isAdmin, hasPermission } from '@queries';

export const show = (req: NaraRequest, res: NaraResponse) => {
  // 1. Check login
  if (!req.user) return jsonError(res, 'Unauthorized', 401);

  // 2. Check admin (bypasses all permission checks)
  if (!isAdmin(req.user.id)) return jsonError(res, 'Forbidden', 403);

  // 3. Check specific permission
  if (!hasPermission(req.user.id, 'users.edit')) return jsonError(res, 'Forbidden', 403);

  // ... handler body
};
```

## Permission Slug Convention

Permissions follow `<resource>.<action>` format:

| Slug | Meaning |
|---|---|
| `users.view` | View user list |
| `users.create` | Create new user |
| `users.edit` | Edit existing user |
| `users.delete` | Delete user |
| `roles.view` | View roles |
| `roles.create` | Create role |
| `roles.edit` | Edit role |
| `roles.delete` | Delete role |

When adding a new resource, add permissions in seeds:

```typescript
// seeds/permissions.ts
const permissions = [
  { slug: 'products.view', name: 'View products', resource: 'products', action: 'view' },
  { slug: 'products.create', name: 'Create products', resource: 'products', action: 'create' },
  // ...
];
```

## Admin Bypass

`isAdmin(userId)` returns `true` for users with the `admin` role. Admin bypasses all `hasPermission` checks. Use this order:

1. `if (!req.user)` — not logged in
2. `if (!isAdmin(req.user.id))` — not admin (for admin-only routes)
3. `if (!hasPermission(req.user.id, 'X.Y'))` — lacks specific permission

## Frontend Permission Gating

```svelte
<script lang="ts">
  import { page as inertiaPage } from '@inertiajs/svelte';
  const currentUser = $derived(inertiaPage.props.user as User | undefined);

  function hasPermission(slug: string): boolean {
    if (!currentUser) return false;
    if (currentUser.roles?.includes('admin')) return true;
    return currentUser.permissions?.includes(slug) ?? false;
  }
</script>

{#if hasPermission('users.create')}
  <Button onclick={openCreateUser}>Add user</Button>
{/if}
```

## Password Hashing

```typescript
import { hashPassword, comparePassword } from '@services/Authenticate';

const hashed = hashPassword(plaintext);
const valid = comparePassword(plaintext, hashed);
```

Never use bcrypt directly — always go through `@services/Authenticate`.

## Session Management

Sessions are handled by `@services/Session` middleware. The `Auth` middleware loads the user + roles + permissions onto `req.user`. You do not manage sessions manually in handlers.

## Role Assignment (sync pattern)

```typescript
import { syncRoles } from '@queries';

// Replace all roles for a user
syncRoles(userId, ['admin', 'editor']);
```

## Do / Don't

- **Do** check `req.user` first, then `isAdmin`, then `hasPermission`
- **Do** use `@services/Authenticate` for password hashing — never bcrypt directly
- **Do** follow `<resource>.<action>` slug convention for new permissions
- **Do** gate frontend UI with `hasPermission()` — don't rely on hiding links alone
- **Don't** trust `req.user.roles` for permission checks — use `hasPermission()` (queries the DB)
- **Don't** create new session logic in handlers — `Auth` middleware handles it
- **Don't** expose password fields in API responses or Inertia props
