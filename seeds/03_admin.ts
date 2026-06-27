import type SQLiteType from '../app/services/SQLite';
import { randomUUID } from 'crypto';
import { hashPassword } from '../app/services/Authenticate';

export function run(SQLite: typeof SQLiteType): void {
  const existing = SQLite.one<{ id: string }>`SELECT id FROM users WHERE email = ${'admin@nara.dev'}`;
  if (existing) return;

  const id = randomUUID();
  const now = Date.now();
  SQLite.exec`
    INSERT INTO users (id, name, email, password, created_at, updated_at)
    VALUES (${id}, ${'Admin'}, ${'admin@nara.dev'}, ${hashPassword('admin123')}, ${now}, ${now})
  `;

  const adminRole = SQLite.one<{ id: string }>`SELECT id FROM roles WHERE slug = ${'admin'}`;
  if (adminRole) {
    SQLite.exec`
      INSERT INTO user_roles (id, user_id, role_id, created_at)
      VALUES (${randomUUID()}, ${id}, ${adminRole.id}, ${now})
    `;
  }
}
