import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { getDatabase } from '../../../shared/database';
import { createAccount } from '../server/accounts';
import { createRole, findAllRoles, getUsersWithRole } from '../server/access';
import { ensureAdministrator } from '../server/administrator';
import { findUserByEmail } from '../server/repository';
import { comparePassword } from '../server/service';

function adminRoleWithoutHolders(): string {
  const role =
    findAllRoles().find((candidate) => candidate.slug === 'admin') ??
    createRole({ id: randomUUID(), name: 'Admin', slug: 'admin', description: null });
  getDatabase().prepare('DELETE FROM user_roles WHERE role_id = ?').run(role.id);
  return role.id;
}

describe('first administrator', () => {
  it('creates the account with the admin role while none exists, then leaves it be', async () => {
    const roleId = adminRoleWithoutHolders();
    const email = `${randomUUID()}@example.com`;

    const created = await ensureAdministrator({ name: 'First Admin', email, password: 'correct horse battery staple', temporaryPassword: true });

    expect(created).toEqual({ status: 'created', email });
    expect(getUsersWithRole(roleId).map((holder) => holder.email)).toEqual([email]);
    const stored = findUserByEmail(email)!;
    expect(stored.must_change_password).toBe(1);
    expect(await comparePassword('correct horse battery staple', stored.password)).toBe(true);

    const again = await ensureAdministrator({ name: 'Second', email: `${randomUUID()}@example.com`, password: 'another long password', temporaryPassword: false });
    expect(again).toEqual({ status: 'existing', email });
    expect(getUsersWithRole(roleId)).toHaveLength(1);
  });

  it('refuses rather than promotes an account that already uses the email', async () => {
    adminRoleWithoutHolders();
    const email = `${randomUUID()}@example.com`;
    createAccount({ id: randomUUID(), name: 'Member', email, passwordHash: 'hash' });

    await expect(
      ensureAdministrator({ name: 'Admin', email: email.toUpperCase(), password: 'correct horse battery staple', temporaryPassword: false }),
    ).rejects.toThrow('A non-admin account with email');
  });
});
