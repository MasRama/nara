import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { getDatabase } from '../../../shared/database';
import {
  createAccount,
  createAccountWithRoles,
  deleteAccounts,
  findAccountById,
  listAccounts,
  resetAccountPassword,
  updateAccount,
  updateAccountWithRoles,
} from '../server/accounts';
import { createRole } from '../server/access';
import { startSession } from '../server/service';

function uniqueEmail(): string {
  return `${randomUUID()}@example.com`;
}

describe('auth account directory', () => {
  it('creates and reads accounts without exposing password hashes', () => {
    const account = createAccount({ id: randomUUID(), name: 'Ada', email: uniqueEmail(), passwordHash: 'hash' });

    expect(account).toMatchObject({ id: account.id, name: 'Ada', avatar: null });
    expect(account).not.toHaveProperty('password');
    expect(findAccountById(account.id)).toEqual(account);
    expect(findAccountById(randomUUID())).toBeUndefined();
  });

  it('lists accounts with search and bounded pagination', () => {
    const marker = randomUUID();
    createAccount({ id: randomUUID(), name: `List ${marker}`, email: uniqueEmail(), passwordHash: 'hash' });
    createAccount({ id: randomUUID(), name: `List ${marker}`, email: uniqueEmail(), passwordHash: 'hash' });

    const page = listAccounts(1, 10, marker);
    expect(page.total).toBe(2);
    expect(page.data).toHaveLength(2);

    const clamped = listAccounts(0, 500, marker);
    expect(clamped.data).toHaveLength(2);
  });


  it('treats SQL LIKE wildcards literally and bounds extreme pages', () => {
    const marker = randomUUID().slice(0, 8);
    const percent = createAccount({ id: randomUUID(), name: `Literal % ${marker}`, email: uniqueEmail(), passwordHash: 'hash' });
    const underscore = createAccount({ id: randomUUID(), name: `Literal _ ${marker}`, email: uniqueEmail(), passwordHash: 'hash' });
    createAccount({ id: randomUUID(), name: `Literal plain ${marker}`, email: uniqueEmail(), passwordHash: 'hash' });

    expect(listAccounts(1, 10, `% ${marker}`).data.map((row) => row.id)).toEqual([percent.id]);
    expect(listAccounts(1, 10, `_ ${marker}`).data.map((row) => row.id)).toEqual([underscore.id]);
    expect(() => listAccounts(Number.MAX_VALUE, Number.MAX_VALUE, marker)).not.toThrow();
  });

  it('rolls back managed account mutations when role persistence fails', () => {
    const createEmail = uniqueEmail();
    expect(() =>
      createAccountWithRoles(
        { id: randomUUID(), name: 'Atomic Create', email: createEmail, passwordHash: 'hash' },
        ['missing-role'],
      ),
    ).toThrow();
    expect(getDatabase().prepare('SELECT id FROM users WHERE email = ?').get(createEmail)).toBeUndefined();

    const account = createAccount({ id: randomUUID(), name: 'Atomic Before', email: uniqueEmail(), passwordHash: 'hash' });
    expect(() => updateAccountWithRoles(account.id, { name: 'Atomic After' }, { roleIds: ['missing-role'] })).toThrow();
    expect(findAccountById(account.id)?.name).toBe('Atomic Before');
  });

  it('updates accounts and rejects duplicate emails', () => {
    const first = createAccount({ id: randomUUID(), name: 'First', email: uniqueEmail(), passwordHash: 'hash' });
    const second = createAccount({ id: randomUUID(), name: 'Second', email: uniqueEmail(), passwordHash: 'hash' });

    const updated = updateAccount(first.id, { name: 'First Updated', avatar: '/avatar.webp' });
    expect(updated).toMatchObject({ id: first.id, name: 'First Updated', avatar: '/avatar.webp' });
    expect(updateAccount(randomUUID(), { name: 'Nobody' })).toBeUndefined();

    for (const write of [
      () => updateAccount(first.id, { email: second.email }),
      () => createAccount({ id: randomUUID(), name: 'Clash', email: second.email, passwordHash: 'hash' }),
    ]) {
      let failed: unknown;
      try {
        write();
      } catch (error) {
        failed = error;
      }
      expect(failed).toMatchObject({ code: 'SQLITE_CONSTRAINT_UNIQUE' });
    }
  });
  it('revokes target sessions when a managed password reset commits', () => {
    const account = createAccount({ id: randomUUID(), name: 'Reset Target', email: uniqueEmail(), passwordHash: 'old-hash' });
    startSession({ ...account, password: 'old-hash', created_at: 1, updated_at: 1 }, undefined);
    expect(getDatabase().prepare('SELECT COUNT(*) AS count FROM sessions WHERE user_id = ?').get(account.id)).toEqual({ count: 1 });

    const updated = resetAccountPassword(account.id, 'new-hash');
    expect(updated?.id).toBe(account.id);
    expect(getDatabase().prepare('SELECT password FROM users WHERE id = ?').get(account.id)).toEqual({ password: 'new-hash' });
    expect(getDatabase().prepare('SELECT COUNT(*) AS count FROM sessions WHERE user_id = ?').get(account.id)).toEqual({ count: 0 });
  });

  it('deletes accounts and cascades their sessions and role assignments', () => {
    const stored = createAccount({ id: randomUUID(), name: 'Temp', email: uniqueEmail(), passwordHash: 'stored-test-hash' });
    const account = findAccountById(stored.id)!;
    const role = createRole({ id: randomUUID(), name: `Temp ${randomUUID()}`, slug: `temp-${randomUUID()}`, description: null });
    getDatabase()
      .prepare('INSERT INTO user_roles (id, user_id, role_id, created_at) VALUES (?, ?, ?, ?)')
      .run(randomUUID(), account.id, role.id, Date.now());
    startSession(
      { ...account, password: 'hash', created_at: 1, updated_at: 1 },
      undefined,
    );
    expect(deleteAccounts([account.id])).toBe(1);
    expect(deleteAccounts([])).toBe(0);
    expect(findAccountById(account.id)).toBeUndefined();
    expect(getDatabase().prepare('SELECT * FROM user_roles WHERE user_id = ?').all(account.id)).toEqual([]);
    expect(getDatabase().prepare('SELECT * FROM sessions WHERE user_id = ?').all(account.id)).toEqual([]);
  });
});
