import type Database from 'better-sqlite3';

const SEED_TIMESTAMP = 1_704_067_200_000;

export function run(database: Database.Database): void {
  const insert = database.prepare(
    `INSERT INTO role_permissions (id, role_id, permission_id, created_at)
     SELECT 'nara-role-permission:' || roles.slug || ':' || permissions.slug,
            roles.id,
            permissions.id,
            ?
     FROM roles
     CROSS JOIN permissions
     WHERE roles.slug = ?
       AND permissions.slug = ?
     ON CONFLICT (role_id, permission_id) DO NOTHING`,
  );

  const allPermissions = database
    .prepare('SELECT slug FROM permissions ORDER BY slug ASC')
    .all() as Array<{ slug: string }>;
  for (const permission of allPermissions) {
    insert.run(SEED_TIMESTAMP, 'admin', permission.slug);
  }

  for (const permission of ['users.view', 'settings.view']) {
    insert.run(SEED_TIMESTAMP, 'user', permission);
  }
}
