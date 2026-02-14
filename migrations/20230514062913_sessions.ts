import { Knex } from "knex";


export async function up(knex: Knex): Promise<void> {
    await knex.schema.createTable('sessions', function (table) {
        table.string('id').primary();
        table.string("user_id").index();
        table.text("user_agent");
        table.bigInteger('expires_at').nullable().index();
        table.bigInteger("created_at");
    });
}


export async function down(knex: Knex): Promise<void> {
    await knex.schema.dropTable('sessions')
}

