import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('assets', (table) => {
    table.string('id').primary();
    table.string('name').nullable();
    table.string('type').notNullable();
    table.string('url').notNullable();
    table.string('mime_type').nullable();
    table.integer('size').nullable();
    table.string('s3_key').nullable().index();
    table.string('user_id').nullable().index();
    table.datetime('created_at').defaultTo(knex.fn.now());
    table.datetime('updated_at').defaultTo(knex.fn.now());
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('assets');
}
