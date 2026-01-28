import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('password_reset_tokens', (table) => {
    table.increments('id').primary();
    table.string('email').notNullable().index();
    table.string('token').notNullable().unique();
    table.bigInteger('created_at').notNullable();
    table.bigInteger('expires_at').notNullable().index();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('password_reset_tokens');
}
