import { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
    await knex.schema.createTable('user_roles', function (table) {
        table.uuid('id').primary().notNullable();
        table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
        table.uuid('role_id').notNullable().references('id').inTable('roles').onDelete('CASCADE');
        table.bigInteger("created_at");

        table.unique(['user_id', 'role_id']);
    });
}

export async function down(knex: Knex): Promise<void> {
    await knex.schema.dropTable('user_roles');
}
