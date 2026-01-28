/**
 * User Seed
 *
 * Creates default admin user for the application.
 */
import { Knex } from 'knex';
import bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';

export async function seed(knex: Knex): Promise<void> {
  // Check if admin already exists
  const existingAdmin = await knex('users').where('email', 'admin@example.com').first();
  if (existingAdmin) {
    console.log('Admin user already exists, skipping seed...');
    return;
  }

  const password = await bcrypt.hash(process.env.ADMIN_PASSWORD || 'password', 10);
  const now = new Date().toISOString();

  await knex('users').insert([
    {
      id: randomUUID(),
      name: process.env.ADMIN_NAME || 'Admin',
      email: process.env.ADMIN_EMAIL || 'admin@example.com',
      phone: null,
      avatar: null,
      role: 'admin',
      email_verified_at: now,
      password: password,
      created_at: now,
      updated_at: now,
    },
  ]);

  console.log('Admin user created successfully!');
}
