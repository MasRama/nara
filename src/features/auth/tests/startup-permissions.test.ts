import { afterEach, describe, expect, it } from 'vitest';
import { getDatabase } from '../../../shared/database';
import { initializeApplicationRuntime, stopApplicationRuntime } from '../../../app/server';

afterEach(stopApplicationRuntime);

describe('application permissions', () => {
  it('writes every declared permission at startup and gives admin all of them', () => {
    const database = getDatabase();
    database.exec('DELETE FROM role_permissions; DELETE FROM permissions;');
    database
      .prepare(
        `INSERT INTO roles (id, name, slug, description, created_at, updated_at)
         VALUES ('nara-role-admin', 'Admin', 'admin', 'Full access', 1, 1)
         ON CONFLICT (slug) DO NOTHING`,
      )
      .run();

    initializeApplicationRuntime();

    const slugs = (database.prepare('SELECT slug FROM permissions ORDER BY slug').all() as Array<{ slug: string }>).map(
      (row) => row.slug,
    );
    expect(slugs).toEqual([
      'activity.view',
      'roles.create',
      'roles.delete',
      'roles.edit',
      'roles.view',
      'users.create',
      'users.delete',
      'users.edit',
      'users.reset-password',
      'users.view',
    ]);
    expect(
      database
        .prepare(
          `SELECT COUNT(*) AS count FROM role_permissions rp
           JOIN roles r ON r.id = rp.role_id
           WHERE r.slug = 'admin'`,
        )
        .get(),
    ).toEqual({ count: 10 });
  });
});
