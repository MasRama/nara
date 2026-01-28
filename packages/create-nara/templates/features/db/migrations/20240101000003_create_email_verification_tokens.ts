import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('email_verification_tokens', (table) => {
    table.increments('id').primary();
    table.uuid('user_id').notNullable().index();
    table.string('token').notNullable().unique();
    table.bigInteger('created_at').notNullable();
    table.bigInteger('expires_at').notNullable().index();

    // Foreign key to users table
    table.foreign('user_id').references('id').inTable('users').onDelete('CASCADE');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('email_verification_tokens');
}
