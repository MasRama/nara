import { Knex } from 'knex';
import { randomUUID } from 'crypto';

export async function seed(knex: Knex): Promise<void> {
  await knex('role_permissions').del();
  await knex('roles').del();

  const adminRole = { id: randomUUID(), name: 'Admin', slug: 'admin', description: 'Full access to all features' };
  const userRole = { id: randomUUID(), name: 'User', slug: 'user', description: 'Standard user access' };

  await knex('roles').insert([adminRole, userRole]);

  const allPermissions = await knex('permissions').select('id');
  await knex('role_permissions').insert(
    allPermissions.map(p => ({
      id: randomUUID(),
      role_id: adminRole.id,
      permission_id: p.id,
    }))
  );

  const userPermissions = await knex('permissions')
    .whereIn('slug', ['users.view', 'settings.view'])
    .select('id');
  
  await knex('role_permissions').insert(
    userPermissions.map(p => ({
      id: randomUUID(),
      role_id: userRole.id,
      permission_id: p.id,
    }))
  );

  console.log(`✓ Seeded 2 roles (admin: all permissions, user: ${userPermissions.length} permissions)`);
}
