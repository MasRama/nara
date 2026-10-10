import { randomUUID } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import { ADMINISTRATOR } from '../../../shared/security/access';
import type { UsersServerHost } from '../server/host';

/**
 * What a provider hands the suite besides its host: the two things Users
 * never does itself, signing in and granting a permission, done the
 * provider's way.
 */
export interface UsersHostFixture {
  host: UsersServerHost;
  /** Signs in with the account's email and password; returns the session token `resolveActor` takes. */
  signIn(email: string, password: string): Promise<string>;
  /** Gives the account the permission through the provider's own grants. */
  grantPermission(userId: string, permission: string): void;
}

const PASSWORD = 'correct horse battery staple';

/**
 * The behaviour Users relies on from its host, beyond what the types say.
 * The application runs it against its binding, so a provider that passes
 * runs Users; Users' own tests run it against an unrelated provider, so the
 * suite cannot quietly describe one provider's habits.
 */
export function describeUsersHost(provider: string, setup: () => UsersHostFixture | Promise<UsersHostFixture>): void {
  describe(`Users host contract: ${provider}`, () => {
    let host: UsersServerHost;
    let fixture: UsersHostFixture;

    beforeAll(async () => {
      fixture = await setup();
      host = fixture.host;
    });

    async function account(overrides: { name?: string; email?: string; roleIds?: string[] } = {}) {
      const created = host.createAccount(
        {
          id: randomUUID(),
          name: overrides.name ?? 'Contract Account',
          email: overrides.email ?? `${randomUUID()}@example.com`,
          passwordHash: await host.hashPassword(PASSWORD),
        },
        overrides.roleIds,
      );
      if (created.status !== 'created') throw new Error(`Account creation answered ${created.status}`);
      return created.account;
    }

    function administratorRole() {
      const role = host.availableRoles().find((candidate) => candidate.administrator);
      if (!role) throw new Error('The provider offers no administrator role');
      return role;
    }

    it('creates an account and finds it again', async () => {
      const created = await account({ name: 'Ada Lovelace' });

      expect(created).toMatchObject({ name: 'Ada Lovelace', avatar: null, revision: expect.any(Number) });
      expect(host.findAccountById(created.id)).toEqual(created);
      expect(host.findAccountById(randomUUID())).toBeUndefined();
    });

    it('answers duplicate-email for an email in use, creating nothing', async () => {
      const existing = await account();
      const id = randomUUID();

      const result = host.createAccount({ id, name: 'Copy', email: existing.email, passwordHash: await host.hashPassword(PASSWORD) });

      expect(result).toEqual({ status: 'duplicate-email' });
      expect(host.findAccountById(id)).toBeUndefined();
    });

    it('raises the revision on every update and refuses an older one without writing', async () => {
      const created = await account({ name: 'Before' });

      const updated = host.updateAccount(created.id, { name: 'After' }, { revision: created.revision });
      expect(updated.status).toBe('updated');
      if (updated.status !== 'updated') return;
      expect(updated.account).toMatchObject({ name: 'After' });
      expect(updated.account.revision).toBeGreaterThan(created.revision);

      const stale = host.updateAccount(created.id, { name: 'Lost' }, { revision: created.revision });
      expect(stale).toEqual({ status: 'stale', account: updated.account });
      expect(host.findAccountById(created.id)).toEqual(updated.account);
    });

    it('answers duplicate-email on an update to an email in use, writing nothing', async () => {
      const taken = await account();
      const created = await account({ name: 'Unchanged' });

      expect(host.updateAccount(created.id, { name: 'Changed', email: taken.email })).toEqual({ status: 'duplicate-email' });
      expect(host.findAccountById(created.id)).toEqual(created);
    });

    it('answers missing for an unknown account', () => {
      expect(host.updateAccount(randomUUID(), { name: 'Nobody' })).toEqual({ status: 'missing' });
    });

    it('gives an account exactly the roles it is created or updated with', async () => {
      const role = administratorRole();
      const created = await account({ roleIds: [role.id] });
      expect(host.rolesForUser(created.id)).toEqual([role.slug]);

      host.updateAccount(created.id, {}, { roleIds: [] });
      expect(host.rolesForUser(created.id)).toEqual([]);
    });

    it('treats holders of an administrator role as administrators, meeting every rule', async () => {
      const created = await account();
      expect(host.allows(created.id, ADMINISTRATOR)).toBe(false);
      expect(host.administrators().map((holder) => holder.id)).not.toContain(created.id);

      host.updateAccount(created.id, {}, { roleIds: [administratorRole().id] });
      expect(host.allows(created.id, ADMINISTRATOR)).toBe(true);
      expect(host.allows(created.id, host.access.manage('delete'))).toBe(true);
      expect(host.administrators().map((holder) => holder.id)).toContain(created.id);

      host.updateAccount(created.id, {}, { roleIds: [] });
      expect(host.allows(created.id, ADMINISTRATOR)).toBe(false);
      expect(host.administrators().map((holder) => holder.id)).not.toContain(created.id);
    });

    it('admits a permission rule once the permission is granted, and no further', async () => {
      const created = await account();
      const view = host.access.manage('view');
      if (!('permission' in view)) throw new Error('Expected manage("view") to be a permission rule');
      expect(host.allows(created.id, view)).toBe(false);

      fixture.grantPermission(created.id, view.permission);

      expect(host.allows(created.id, view)).toBe(true);
      expect(host.allows(created.id, host.access.manage('delete'))).toBe(false);
      expect(host.allows(created.id, ADMINISTRATOR)).toBe(false);
    });

    it('hashes passwords the provider signs in with, and resolves the session', async () => {
      expect(await host.hashPassword(PASSWORD)).not.toContain(PASSWORD);
      const created = await account();

      const token = await fixture.signIn(created.email, PASSWORD);

      expect(host.resolveActor(token)).toEqual({ id: created.id, avatar: null });
      expect(host.resolveActor(undefined)).toBeUndefined();
      expect(host.resolveActor(randomUUID())).toBeUndefined();
    });

    it('ends every session when a password is reset', async () => {
      const created = await account();
      const token = await fixture.signIn(created.email, PASSWORD);
      const replacement = 'a different long password';

      expect(host.resetPassword(created.id, await host.hashPassword(replacement))).toMatchObject({ id: created.id });

      expect(host.resolveActor(token)).toBeUndefined();
      expect(host.resolveActor(await fixture.signIn(created.email, replacement))).toMatchObject({ id: created.id });
      expect(host.resetPassword(randomUUID(), await host.hashPassword(replacement))).toBeUndefined();
    });

    it('lists matches a page at a time, counting all of them', async () => {
      const marker = randomUUID();
      const named = await Promise.all([1, 2, 3].map((n) => account({ name: `Listed ${marker} ${n}` })));
      const byEmail = await account({ email: `${marker}@example.com` });

      const first = host.listAccounts(1, 2, marker);
      expect(first.total).toBe(4);
      expect(first.data).toHaveLength(2);
      const all = [...first.data, ...host.listAccounts(2, 2, marker).data].map((listed) => listed.id).sort();
      expect(all).toEqual([...named, byEmail].map((listed) => listed.id).sort());
    });

    it('deletes accounts, counting only those that existed', async () => {
      const first = await account();
      const second = await account();

      expect(host.deleteAccounts([first.id, second.id, randomUUID()])).toBe(2);
      expect(host.findAccountById(first.id)).toBeUndefined();
      expect(host.findAccountById(second.id)).toBeUndefined();
    });
  });
}
