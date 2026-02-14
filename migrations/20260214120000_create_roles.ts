import { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
    await knex.schema.createTable('roles', function (table) {
        table.uuid('id').primary().notNullable();
        table.string('name', 100).notNullable(); // Display name
        table.string('slug', 100).unique().notNullable(); // URL-friendly name
        table.text('description').nullable();
        table.bigInteger("created_at");
        table.bigInteger("updated_at");
    });
}

export async function down(knex: Knex): Promise<void> {
    await knex.schema.dropTable('roles');
}
