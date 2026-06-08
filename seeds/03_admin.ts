import { Knex } from 'knex';
import { randomUUID } from 'crypto';
import { pbkdf2Sync, randomBytes } from 'crypto';

export async function seed(knex: Knex): Promise<void> {
  await knex('user_roles').del();
  await knex('users').del();

  const salt = randomBytes(16).toString('hex');
  const hash = pbkdf2Sync('admin123', salt, 100000, 64, 'sha512').toString('hex');
  const password = `${salt}:${hash}`;

  const admin = {
    id: randomUUID(),
    name: 'Admin',
    email: 'admin@nara.dev',
    password,
    is_verified: true,
    created_at: Date.now(),
    updated_at: Date.now(),
  };

  await knex('users').insert(admin);

  const adminRole = await knex('roles').where('slug', 'admin').first();
  if (adminRole) {
    await knex('user_roles').insert({
      id: randomUUID(),
      user_id: admin.id,
      role_id: adminRole.id,
    });
  }

  console.log('✓ Seeded admin user (admin@nara.dev / admin123)');
}
