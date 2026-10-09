import { hc } from 'hono/client';
import type { authRoutes, createAccessRoutes } from '..';

/**
 * Compile-time checks that the web clients see the real routes: `npm run lint`
 * fails when a route, request body, or response stops matching, including
 * when an `@ts-expect-error` below stops being an error. Never called.
 */
export async function authRouteTypes(): Promise<void> {
  const auth = hc<typeof authRoutes>('/api/auth');
  const roles = hc<ReturnType<typeof createAccessRoutes>>('/api/roles');

  // @ts-expect-error no such route
  void auth.signin;
  // @ts-expect-error login takes an email, not a username
  await auth.login.$post({ json: { username: 'grace', password: 'secret' } });
  // @ts-expect-error a role's permissions are a list of slugs
  await roles.index.$post({ json: { name: 'Editors', slug: 'editors', permissions: 'roles.view' } });
  // @ts-expect-error the code is a string
  await auth['two-factor'].enable.$post({ json: { code: 123456 } });

  // Refusal codes are the ones Auth's contract declares, so a misspelt branch fails to compile.
  const login = await (await auth.login.$post({ json: { email: 'grace@example.com', password: 'secret' } })).json();
  if (!login.success) {
    void (login.code === 'LOGIN_LOCKED');
    // @ts-expect-error Auth declares no LOGIN_FAILED refusal
    void (login.code === 'LOGIN_FAILED');
  }

  const sessions = await (await auth.sessions.$get()).json();
  if (sessions.success) {
    const lastSeenAt: number | null = sessions.data.sessions[0].lastSeenAt;
    void lastSeenAt;
    // @ts-expect-error session handles never expose the token
    void sessions.data.sessions[0].token;
  }

  const created = await (await roles.index.$post({ json: { name: 'Editors', slug: 'editors' } })).json();
  if (created.success) {
    const userCount: number = created.data.role.userCount;
    void userCount;
  }
}
