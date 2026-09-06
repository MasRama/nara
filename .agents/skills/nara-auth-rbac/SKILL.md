---
name: nara-auth-rbac
description: Adding auth guards, permission checks, role management, or session handling
---

# Auth & RBAC

Procedural guidance for modifying the local/reference Auth provider,
session/RBAC behavior, or application-level Auth composition.

## Scope: provider work, not reusable-Feature coupling

A reusable Feature must NOT directly depend on Auth implementation — not on
its routes, services, repositories, tables, or session helpers. When a
reusable Feature needs identity or authorization behavior it does not own,
it declares a typed host requirement instead:

```text
Reusable Feature
→ declares typed host requirements

Application binding
→ adapts host requirements

Chosen Auth provider
→ fulfills those requirements
```

Concretely: Users never imports Auth. Users declares `UsersServerHost` /
`UsersWebHost`; `src/app/bindings/users.server.ts` and
`src/app/bindings/users.web.ts` adapt those requirements to the selected
Auth provider. Swapping the provider means writing a new binding, never
editing the Feature. There is no DI container, service locator, or provider
registry — bindings are plain TypeScript values passed to explicit factory
arguments and route props.

## Ownership

The Auth provider owns identity end to end:

```text
Auth provider
→ identity
→ credentials
→ sessions
→ roles/permissions
→ provider-level authorization APIs
```

In the reference application that is `src/features/auth/` (`contract.ts`,
`server/accounts.ts`, `server/service.ts`, `server/access.ts`,
`server/repository.ts`, plus routes). Other capabilities reach accounts
only through the provider's public boundary or through a typed host
requirement adapted in an application-owned binding — never through direct
SQL on Auth-owned tables. Full model: `../../ARCHITECTURE.md` and
`../../docs/v3/database-lifecycle.md`.

## Host-requirement pattern (for reusable Features)

Declare the capability the Feature needs but does not own. The real
`UsersServerHost` is the reference shape:

```typescript
import type { UsersServerHost } from '@/features/users/server/host';

export function createUserRoutes(host: UsersServerHost) {
  // Resolve the actor through the host, never through Auth imports.
  const actor = host.resolveActor(sessionToken);
  if (!host.canManageUsers(actor.id, 'edit')) return forbidden(context);
  if (rolesChanged && !host.canAssignRoles(actor.id)) return forbidden(context);
}
```

Adapt it in the application binding, where the Auth vocabulary is
translated into the host vocabulary:

```typescript
// src/app/bindings/users.server.ts
import { getCurrentUser, hasPermission, isAdmin } from '@/features/auth';

export const usersServerHost: UsersServerHost = {
  resolveActor: (sessionToken) => {
    const user = getCurrentUser(sessionToken);
    return user ? { id: user.id, avatar: user.avatar } : undefined;
  },
  canManageUsers: (actorId, action) => isAdmin(actorId) || hasPermission(actorId, `users.${action}`),
  canAssignRoles: (actorId) => isAdmin(actorId),
  // ...account directory, roles, session cookie name
};
```

The web side mirrors this: pages receive a `UsersWebHost` (`can()`,
`isAdmin()`, `currentSessionUser()`, `listRoles()`, `changePassword()`,
CSRF) as route props from `src/app/bindings/users.web.ts`. Users web never
imports Auth web internals.

## Direct Auth APIs (provider and bindings only)

`getCurrentUser`, `hasPermission`, and `isAdmin` from
`src/features/auth` are appropriate inside Auth implementation itself,
application-owned Auth composition, and application-owned bindings. They
are not the default recipe for an arbitrary reusable Feature — that path
goes through a typed host requirement.

Route-guard shape for provider-owned routes:

```typescript
import { getCookie } from 'hono/cookie';
import type { Context } from 'hono';
import { getCurrentUser, hasPermission, isAdmin, SESSION_COOKIE_NAME } from '@/features/auth';

const user = getCurrentUser(getCookie(context, SESSION_COOKIE_NAME));
if (!user) return unauthorized(context);
if (!isAdmin(user.id) && !hasPermission(user.id, 'users.edit')) {
  return forbidden(context);
}
```

Resolve the session before reading user data. Keep route-specific response
helpers local to the Feature; never trust a client-provided role or
permission list as the security decision.

## Permission slugs and admin bypass

Permissions follow `<resource>.<action>` (`users.view`, `users.create`,
`users.edit`, `users.delete`, `roles.view`, …). The owning Feature defines
its permission data; the server route enforces it in this order:

1. resolve the session user
2. allow the `admin` bypass where the route requires it
3. check the specific permission with `hasPermission(userId, '<resource>.<action>')`

Password hashing and session creation stay inside the Auth service;
boundaries expose only `hashPassword()` and session-token operations.
Session cookies stay HTTP-only with the configured expiry and production
secure flags. Never return password hashes from an API.

## Browser authorization

Browser permission gating is UX only. The server remains authoritative.

Distinguish the three layers: provider-owned/server Auth checks (the real
decision, in Hono routes), reusable Feature host requirements (`can()` /
`isAdmin()` on the web host, mirroring the server), and application-owned
adaptation (the web binding implementing the host from the Auth session).
A hidden button without the matching server check is a bug, not a fix.

## Do / Don't

- **Do** modify sessions, roles, and permissions inside the Auth provider.
- **Do** give reusable Features typed host requirements plus bindings.
- **Do** enforce permissions in Hono routes, not only in Vue.
- **Do** use the `<resource>.<action>` permission convention.
- **Don't** import Auth implementation from a reusable Feature.
- **Don't** create session logic in unrelated Features.
- **Don't** trust browser-provided roles or permissions.
- **Don't** add a second auth mechanism without an explicit specification.
