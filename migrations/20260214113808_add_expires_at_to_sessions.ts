import { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
    // Add expires_at column to sessions table for TTL support
    await knex.schema.table('sessions', function (table) {
        table.bigInteger('expires_at').nullable();
        table.index('expires_at'); // Index for efficient cleanup queries
    });

    // Set default expiration for existing sessions (30 days from now)
    const thirtyDaysFromNow = Date.now() + (30 * 24 * 60 * 60 * 1000);
    await knex('sessions').update({ expires_at: thirtyDaysFromNow });
}

export async function down(knex: Knex): Promise<void> {
    await knex.schema.table('sessions', function (table) {
        table.dropIndex('expires_at');
        table.dropColumn('expires_at');
    });
}
