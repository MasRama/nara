import { Knex } from 'knex';
import { randomUUID } from 'crypto';

export async function seed(knex: Knex): Promise<void> {
  await knex('permissions').del();

  const permissions = [
    // Users
    { id: randomUUID(), name: 'View Users', slug: 'users.view', resource: 'users', action: 'view' },
    { id: randomUUID(), name: 'Create Users', slug: 'users.create', resource: 'users', action: 'create' },
    { id: randomUUID(), name: 'Edit Users', slug: 'users.edit', resource: 'users', action: 'edit' },
    { id: randomUUID(), name: 'Delete Users', slug: 'users.delete', resource: 'users', action: 'delete' },
    
    // Roles
    { id: randomUUID(), name: 'View Roles', slug: 'roles.view', resource: 'roles', action: 'view' },
    { id: randomUUID(), name: 'Create Roles', slug: 'roles.create', resource: 'roles', action: 'create' },
    { id: randomUUID(), name: 'Edit Roles', slug: 'roles.edit', resource: 'roles', action: 'edit' },
    { id: randomUUID(), name: 'Delete Roles', slug: 'roles.delete', resource: 'roles', action: 'delete' },
    
    // Settings
    { id: randomUUID(), name: 'View Settings', slug: 'settings.view', resource: 'settings', action: 'view' },
    { id: randomUUID(), name: 'Edit Settings', slug: 'settings.edit', resource: 'settings', action: 'edit' },
  ];

  await knex('permissions').insert(permissions);
  console.log(`✓ Seeded ${permissions.length} permissions`);
}
