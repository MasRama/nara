import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { app, resetSecurityState } from '../../../app/server';
import { getDatabase } from '../../../shared/database';
import { installBrowser, type TestBrowser } from '../../../shared/security/tests/browser';
import { authResponseSchemas } from '../contract';
import { createAccessClient, createAuthClient } from '../web';
import { createSecurityClient } from '../web/security-client';
import { totpCode, totpStep } from '../server/totp';

/**
 * Every Auth web client method runs against the real server and its answer
 * must match the declared contract exactly, refusals included.
 */
function makeAdmin(userId: string): void {
  const database = getDatabase();
  const existing = database.prepare("SELECT id FROM roles WHERE slug = 'admin'").get() as { id: string } | undefined;
  const roleId = existing?.id ?? randomUUID();
  if (!existing) {
    database
      .prepare(
        `INSERT INTO roles (id, name, slug, description, created_at, updated_at)
         VALUES (?, 'Administrator', 'admin', NULL, ?, ?)`,
      )
      .run(roleId, Date.now(), Date.now());
  }
  database
    .prepare('INSERT INTO user_roles (id, user_id, role_id, created_at) VALUES (?, ?, ?, ?)')
    .run(randomUUID(), userId, roleId, Date.now());
}

const schemas = authResponseSchemas();

describe('auth web client contract', () => {
  let browser: TestBrowser;

  beforeEach(() => {
    browser = installBrowser(app);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('registers, reads, and ends a session in the declared shapes', async () => {
    const auth = createAuthClient();
    schemas.csrfToken.parse(await (await fetch('/api/auth/csrf')).json());
    expect(schemas.error.parse(await auth.me())).toMatchObject({ code: 'UNAUTHORIZED' });

    const email = `${randomUUID()}@example.com`;
    const password = 'correct horse battery staple';
    schemas.register.parse(await auth.register({ name: 'Contract Reader', email, password }));
    expect(schemas.error.parse(await auth.register({ name: 'Contract Reader', email, password }))).toMatchObject({
      success: false,
    });

    const me = schemas.me.parse(await auth.me());
    expect(me.data.user.email).toBe(email);

    schemas.message.parse(await auth.logout());
    expect(schemas.error.parse(await auth.login({ email, password: 'wrong password entirely' }))).toMatchObject({
      success: false,
    });
    expect(schemas.login.parse(await auth.login({ email, password })).data.twoFactorRequired).toBe(false);
  });

  it('changes a password in the declared shapes', async () => {
    const auth = createAuthClient();
    const account = await browser.signUp();

    expect(
      schemas.error.parse(
        await auth.changePassword({ current_password: 'not the password', new_password: 'another long passphrase' }),
      ),
    ).toMatchObject({ code: 'INVALID_PASSWORD' });
    schemas.message.parse(
      await auth.changePassword({ current_password: account.password, new_password: 'another long passphrase' }),
    );
    expect(schemas.error.parse(await auth.changePassword({ current_password: '', new_password: '' }))).toMatchObject({
      code: 'VALIDATION_ERROR',
    });
  });

  it('manages sessions in the declared shapes', async () => {
    const security = createSecurityClient();
    expect(schemas.error.parse(await security.listSessions())).toMatchObject({ code: 'UNAUTHORIZED' });

    await browser.signUp();
    const listed = schemas.sessions.parse(await security.listSessions());
    expect(listed.data.sessions.filter((session) => session.current)).toHaveLength(1);

    schemas.revokeSessions.parse(await security.revokeOtherSessions());
    expect(schemas.error.parse(await security.revokeSession('unknown-handle'))).toMatchObject({ code: 'NOT_FOUND' });
  });

  it('runs two-factor setup, sign-in, and removal in the declared shapes', async () => {
    const auth = createAuthClient();
    const security = createSecurityClient();
    const account = await browser.signUp();

    expect(schemas.twoFactor.parse(await security.twoFactorStatus()).data.twoFactor.enabled).toBe(false);
    expect(schemas.error.parse(await security.startTwoFactorSetup({ password: 'not the password' }))).toMatchObject({
      code: 'INVALID_PASSWORD',
    });
    const setup = schemas.twoFactorSetupStarted.parse(await security.startTwoFactorSetup({ password: account.password }));
    const enabled = schemas.recoveryCodes.parse(
      await security.enableTwoFactor({ code: totpCode(setup.data.secret, totpStep()) }),
    );
    const regenerated = schemas.recoveryCodes.parse(
      await security.regenerateRecoveryCodes({ password: account.password }),
    );
    expect(regenerated.data.recoveryCodes).not.toEqual(enabled.data.recoveryCodes);

    // Rate-limited Auth paths share one budget per client; this flow spends more than one window allows.
    resetSecurityState();
    schemas.message.parse(await auth.logout());
    const login = schemas.login.parse(await auth.login({ email: account.email, password: account.password }));
    expect(login.data.twoFactorRequired).toBe(true);
    expect(schemas.error.parse(await security.completeTwoFactor({ code: '000000' }))).toMatchObject({
      success: false,
    });
    schemas.message.parse(await security.completeTwoFactor({ recovery_code: regenerated.data.recoveryCodes[0]! }));

    schemas.message.parse(await security.disableTwoFactor({ password: account.password }));
    expect(schemas.error.parse(await security.disableTwoFactor({ password: account.password }))).toMatchObject({
      code: 'TWO_FACTOR_DISABLED',
    });
  });

  it('manages roles in the declared shapes', async () => {
    const access = createAccessClient();
    const account = await browser.signUp();
    expect(schemas.error.parse(await access.listRoles())).toMatchObject({ code: 'FORBIDDEN' });

    makeAdmin(account.id);
    schemas.roles.parse(await access.listRoles());
    const permissions = schemas.permissions.parse(await access.listPermissions());
    const slug = Object.values(permissions.data).flat()[0]?.slug;

    const roleSlug = `contract-${randomUUID()}`;
    const created = schemas.roleSaved.parse(
      await access.createRole({ name: 'Contract Role', slug: roleSlug, permissions: slug ? [slug] : [] }),
    );
    expect(schemas.error.parse(await access.createRole({ name: 'Duplicate', slug: roleSlug, permissions: [] }))).toMatchObject({
      code: 'DUPLICATE_SLUG',
    });
    schemas.roleSaved.parse(await access.updateRole(created.data.role.id, { name: 'Contract Role Renamed' }));
    expect(schemas.error.parse(await access.updateRole(randomUUID(), { name: 'Missing' }))).toMatchObject({
      code: 'NOT_FOUND',
    });
    expect(schemas.rolesDeleted.parse(await access.deleteRoles({ ids: [created.data.role.id] })).data.deleted).toBe(1);
    expect(schemas.error.parse(await access.deleteRoles({ ids: [] }))).toMatchObject({ code: 'VALIDATION_ERROR' });
  });
});
