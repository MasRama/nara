import { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
    await knex.schema.createTable('permissions', function (table) {
        table.uuid('id').primary().notNullable();
        table.string('name', 100).notNullable();
        table.string('slug', 100).unique().notNullable();
        table.string('resource', 100).notNullable(); // e.g., 'users', 'posts'
        table.string('action', 100).notNullable(); // e.g., 'view', 'create', 'edit', 'delete'
        table.text('description').nullable();
        table.bigInteger("created_at");
        table.bigInteger("updated_at");
    });
}

export async function down(knex: Knex): Promise<void> {
    await knex.schema.dropTable('permissions');
}
