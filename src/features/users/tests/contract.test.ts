import { randomUUID } from 'node:crypto';
import { rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { app } from '../../../app/server';
import { usersWebHost } from '../../../app/bindings/users.web';
import { grantAdmin } from '../../../app/tests/personas';
import { installBrowser, type TestBrowser } from '../../../shared/security/tests/browser';
import { usersResponseSchemas } from '../contract';
import { createUsersClient } from '../web/client';

/**
 * Every Users web client method runs against the real server, with the
 * application's own CSRF adapter, and its answer must match the declared
 * contract exactly, refusals included.
 */
const ONE_PIXEL_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
);

const schemas = usersResponseSchemas();

describe('users web client contract', () => {
  let browser: TestBrowser;
  const client = createUsersClient({ csrf: usersWebHost.csrf });

  beforeEach(() => {
    browser = installBrowser(app);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('reads and edits the signed-in profile in the declared shapes', async () => {
    expect(schemas.error.parse(await client.me())).toMatchObject({ code: 'UNAUTHORIZED' });

    const account = await browser.signUp('Profile Owner');
    const { revision } = schemas.profileSaved.parse(await client.me()).data.user;
    const saved = schemas.profileSaved.parse(await client.updateProfile({ revision, name: 'Profile Renamed', email: account.email }));
    expect(saved.data.user).toMatchObject({ name: 'Profile Renamed', revision: revision + 1 });
    expect(
      schemas.staleProfile.parse(await client.updateProfile({ revision, name: 'Profile Stale', email: account.email })).current,
    ).toMatchObject({ name: 'Profile Renamed', revision: revision + 1 });
    expect(schemas.error.parse(await client.updateProfile({ revision, name: '', email: account.email }))).toMatchObject({
      code: 'VALIDATION_ERROR',
    });
  });

  it('uploads an avatar in the declared shape', async () => {
    await browser.signUp('Avatar Owner');
    const uploaded = schemas.avatarUploaded.parse(
      await client.uploadAvatar(new File([ONE_PIXEL_PNG], 'avatar.png', { type: 'image/png' })),
    );
    await rm(resolve(process.cwd(), 'storage', 'avatars', uploaded.data.url.split('/').pop()!), { force: true });

    expect(
      schemas.error.parse(await client.uploadAvatar(new File(['not an image'], 'note.txt', { type: 'text/plain' }))),
    ).toMatchObject({ success: false });
  });

  it('manages accounts in the declared shapes', async () => {
    const admin = await browser.signUp('Users Administrator');
    expect(schemas.error.parse(await client.listUsers())).toMatchObject({ code: 'FORBIDDEN' });

    grantAdmin(admin.id);
    schemas.users.parse(await client.listUsers({ page: 1, limit: 5, search: 'Administrator' }));

    const email = `${randomUUID()}@example.com`;
    const created = schemas.userSaved.parse(
      await client.createUser({ name: 'Managed Account', email, password: 'correct horse battery staple' }),
    );
    expect(
      schemas.error.parse(
        await client.createUser({ name: 'Managed Account', email, password: 'correct horse battery staple' }),
      ),
    ).toMatchObject({ code: 'DUPLICATE_EMAIL' });

    const { id, revision } = created.data.user;
    schemas.userSaved.parse(await client.updateUser(id, { revision, name: 'Managed Renamed' }));
    expect(schemas.staleUser.parse(await client.updateUser(id, { revision, name: 'Managed Stale' })).current).toMatchObject({
      name: 'Managed Renamed',
      revision: revision + 1,
    });
    expect(schemas.error.parse(await client.updateUser(randomUUID(), { revision, name: 'Missing' }))).toMatchObject({
      code: 'NOT_FOUND',
    });
    expect(schemas.message.parse(await client.startEditing(id))).toMatchObject({ success: true });
    expect(schemas.usersEditing.parse(await client.listEditing()).data.editing[id]).toEqual([
      { id: admin.id, name: 'Users Administrator' },
    ]);
    schemas.message.parse(await client.stopEditing(id));
    expect(schemas.usersEditing.parse(await client.listEditing()).data.editing[id]).toBeUndefined();
    expect(schemas.error.parse(await client.startEditing(randomUUID()))).toMatchObject({ code: 'NOT_FOUND' });
    schemas.userSaved.parse(await client.resetPassword(id, { password: 'a brand new passphrase' }));
    expect(schemas.error.parse(await client.resetPassword(admin.id, { password: 'a brand new passphrase' }))).toMatchObject({
      code: 'CURRENT_PASSWORD_REQUIRED',
    });

    expect(schemas.usersDeleted.parse(await client.deleteUsers({ ids: [id] })).data.deleted).toBe(1);
    expect(schemas.error.parse(await client.deleteUsers({ ids: [] }))).toMatchObject({
      code: 'VALIDATION_ERROR',
    });
  });
});
