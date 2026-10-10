import { hc } from 'hono/client';
import type { createUserRoutes } from '..';

/**
 * Compile-time checks that the web client sees the real routes: `npm run lint`
 * fails when a route, request body, or response stops matching, including
 * when an `@ts-expect-error` below stops being an error. Never called.
 */
export async function usersRouteTypes(): Promise<void> {
  const users = hc<ReturnType<typeof createUserRoutes>>('/api/users');

  // @ts-expect-error no such route
  void users.search;
  // @ts-expect-error role assignments are slugs
  await users[':id'].$put({ param: { id: 'u1' }, json: { roles: [1] } });
  // @ts-expect-error deleting takes a list of ids
  await users.index.$delete({ json: { id: 'u1' } });

  // Refusal codes are the ones Users' contract declares, so a misspelt branch fails to compile.
  const deleted = await (await users.index.$delete({ json: { ids: ['u1'] } })).json();
  if (!deleted.success) {
    void (deleted.code === 'LAST_ADMIN');
    // @ts-expect-error Users declares no LAST_ADMINISTRATOR refusal
    void (deleted.code === 'LAST_ADMINISTRATOR');
  }

  const listed = await (await users.index.$get({ query: { page: '1', search: 'grace' } })).json();
  if (listed.success) {
    const roles: string[] = listed.data.users[0].roles;
    void roles;
    // @ts-expect-error managed users never expose a password hash
    void listed.data.users[0].password;
  }
}
