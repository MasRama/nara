import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { findAllRoles, getUserRoles, hasPermission, isAdmin } from '../../features/auth';
import { app } from '../server';
import { grantAdmin, grantPermissions, grantRole, requirePasswordChange, revokeRoleFromEveryone, signUp } from './personas';

const ROOT = resolve(__dirname, '../../..');
const AUTH_FEATURE = join(ROOT, 'src/features/auth');

/** The tables Auth's migrations create; Auth is their only writer. */
function authTables(): string[] {
  const directory = join(AUTH_FEATURE, 'server/migrations');
  const tables = new Set<string>();
  for (const file of readdirSync(directory).filter((name) => name.endsWith('.sql'))) {
    for (const match of readFileSync(join(directory, file), 'utf8').matchAll(/CREATE TABLE\s+(?:IF NOT EXISTS\s+)?["`]?(\w+)/gi)) {
      tables.add(match[1].toLowerCase());
    }
  }
  return [...tables];
}

/**
 * Tests that write those tables for a reason no persona serves. Fixture
 * applications under src/cli are skipped wholesale: they are not this app.
 */
const EXEMPT = new Map([
  ['src/app/observability.test.ts', 'needs expired session rows to prove Auth maintenance runs; no route creates one'],
  ['tests/v3/database-lifecycle.test.ts', 'exercises the migrator on standalone in-memory databases'],
]);

function testFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      const skipped = entry.name === 'node_modules' || path === AUTH_FEATURE || path === join(ROOT, 'src/cli');
      return skipped ? [] : testFiles(path);
    }
    const isTest = /\.test\.ts$/.test(entry.name) || path.split('/').includes('tests');
    return isTest && /\.(ts|vue)$/.test(entry.name) ? [path] : [];
  });
}

function writesAuthTables(): RegExp {
  const tables = authTables();
  expect(tables).toEqual(expect.arrayContaining(['users', 'roles', 'user_roles', 'sessions']));
  return new RegExp(`\\b(?:INSERT\\s+(?:OR\\s+\\w+\\s+)?INTO|UPDATE|DELETE\\s+FROM)\\s+["\`]?(?:${tables.join('|')})\\b`, 'i');
}

describe('test personas', () => {
  it('leave writing Auth tables to Auth: tests elsewhere use these helpers', () => {
    const write = writesAuthTables();
    const offenders = ['src', 'official-features', 'tests']
      .flatMap((directory) => testFiles(join(ROOT, directory)))
      .filter((file) => write.test(readFileSync(file, 'utf8')))
      .map((file) => relative(ROOT, file))
      .filter((file) => !EXEMPT.has(file));

    expect(offenders).toEqual([]);
  });

  it('leave writing Auth tables to Auth in setup scripts too, which make the first administrator through it', () => {
    const write = writesAuthTables();
    const directory = join(ROOT, 'scripts');
    const offenders = readdirSync(directory)
      .filter((name) => name.endsWith('.ts') && write.test(readFileSync(join(directory, name), 'utf8')))
      .map((name) => `scripts/${name}`);

    expect(offenders).toEqual([]);
  });

  it('sign up through Auth and grant through its public boundary', async () => {
    const persona = await signUp('Persona Check');
    expect((await app.request('/api/auth/me', { headers: { Cookie: persona.cookie } })).status).toBe(200);

    grantPermissions(persona.id, ['users.view']);
    expect(hasPermission(persona.id, 'users.view')).toBe(true);
    expect(isAdmin(persona.id)).toBe(false);

    grantAdmin(persona.id);
    expect(isAdmin(persona.id)).toBe(true);
    expect(getUserRoles(persona.id)).toHaveLength(2);

    revokeRoleFromEveryone('admin');
    expect(isAdmin(persona.id)).toBe(false);
    expect(hasPermission(persona.id, 'users.view')).toBe(true);
  });

  it('refuses a permission no Feature declares', async () => {
    const persona = await signUp();
    expect(() => grantRole(persona.id, 'typo-role', ['users.veiw'])).toThrow('No Feature declares the permission "users.veiw"');
    expect(findAllRoles().some((role) => role.slug === 'typo-role')).toBe(false);
  });

  it('hand back a session that must replace its temporary password', async () => {
    const temporary = await requirePasswordChange(await signUp());

    const blocked = await app.request('/api/users/me', { headers: { Cookie: temporary.cookie } });
    expect(blocked.status).toBe(403);
    await expect(blocked.json()).resolves.toMatchObject({ code: 'PASSWORD_CHANGE_REQUIRED' });
    expect((await app.request('/api/auth/me', { headers: { Cookie: temporary.cookie } })).status).toBe(200);
  });
});
