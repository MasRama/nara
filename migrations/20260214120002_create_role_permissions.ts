import { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
    await knex.schema.createTable('role_permissions', function (table) {
        table.uuid('id').primary().notNullable();
        table.uuid('role_id').notNullable().references('id').inTable('roles').onDelete('CASCADE');
        table.uuid('permission_id').notNullable().references('id').inTable('permissions').onDelete('CASCADE');
        table.bigInteger("created_at");

        table.unique(['role_id', 'permission_id']);
    });
}

export async function down(knex: Knex): Promise<void> {
    await knex.schema.dropTable('role_permissions');
}
