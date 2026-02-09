/**
 * User Seed
 *
 * Creates default admin user for the application.
 */
import { Knex } from 'knex';
import bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';

export async function seed(knex: Knex): Promise<void> {
  // Delete all existing users first
  await knex('users').del();

  const password = await bcrypt.hash('nara', 10);
  const now = Date.now();

  await knex('users').insert([
    {
      id: randomUUID(),
      name: 'Nara',
      email: 'nara@ramaren.com',
      phone: null,
      avatar: null,
      is_verified: false,
      membership_date: null,
      is_admin: true,
      password: password,
      remember_me_token: null,
      created_at: now,
      updated_at: now,
    },
  ]);

  console.log('Admin user created successfully!');
}
