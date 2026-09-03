import type Database from 'better-sqlite3';

const SEED_TIMESTAMP = 1_704_067_200_000;

const roles = [
  {
    id: 'nara-role-admin',
    name: 'Admin',
    slug: 'admin',
    description: 'Full access to all features',
  },
  {
    id: 'nara-role-user',
    name: 'User',
    slug: 'user',
    description: 'Standard user access',
  },
] as const;

export function run(database: Database.Database): void {
  const insert = database.prepare(
    `INSERT INTO roles (id, name, slug, description, created_at, updated_at)
     VALUES (@id, @name, @slug, @description, @createdAt, @updatedAt)
     ON CONFLICT (slug) DO NOTHING`,
  );

  for (const role of roles) {
    insert.run({
      ...role,
      createdAt: SEED_TIMESTAMP,
      updatedAt: SEED_TIMESTAMP,
    });
  }
}
