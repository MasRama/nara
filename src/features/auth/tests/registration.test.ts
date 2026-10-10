import { randomUUID } from 'node:crypto';
import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import { getDatabase } from '../../../shared/database';
import { createRole, findRoleBySlug, getUserRoles } from '../server/access';
import { findUserByEmail } from '../server/repository';
import { createAuthRoutes, type AuthRoutesOptions } from '../server/routes';

function register(options: AuthRoutesOptions) {
  const app = new Hono().route('/api/auth', createAuthRoutes(undefined, options));
  const email = `${randomUUID()}@example.com`;
  const request = app.request('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'New Account', email, password: 'correct-horse-battery' }),
  });
  return { email, request };
}

function roleNamed(slug: string): string {
  return findRoleBySlug(slug)?.id ?? createRole({ id: randomUUID(), name: slug, slug, description: null }).id;
}

describe('registration choices', () => {
  it('is open by default and gives a new account no role', async () => {
    const { email, request } = register({});
    expect((await request).status).toBe(201);
    expect(getUserRoles(findUserByEmail(email)!.id)).toEqual([]);
  });

  it('gives every new account the role the application names', async () => {
    roleNamed('customer');
    const { email, request } = register({ registration: { role: 'customer' } });
    expect((await request).status).toBe(201);
    expect(getUserRoles(findUserByEmail(email)!.id).map((role) => role.slug)).toEqual(['customer']);
  });

  it('creates no account when the named role does not exist', async () => {
    const { email, request } = register({ registration: { role: 'missing-role' } });
    expect((await request).status).toBe(500);
    expect(findUserByEmail(email)).toBeUndefined();
  });

  it('answers like an absent route when registration is closed, before reading the body', async () => {
    const before = (getDatabase().prepare('SELECT COUNT(*) AS count FROM users').get() as { count: number }).count;
    const { request } = register({ registration: false });
    expect((await request).status).toBe(404);
    expect(getDatabase().prepare('SELECT COUNT(*) AS count FROM users').get()).toEqual({ count: before });
  });

  it('refuses to make every visitor an administrator', () => {
    expect(() => createAuthRoutes(undefined, { registration: { role: 'admin' } })).toThrow('every visitor would become an administrator');
  });
});
