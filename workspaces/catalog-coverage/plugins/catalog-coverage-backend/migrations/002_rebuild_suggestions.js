// @ts-check

/**
 * Knex migration 002: rebuild the `suggestions` table.
 *
 * SQLite does not support DROP COLUMN. The table created by 001 has
 * `expires_at NOT NULL` and `readme_sha`, neither of which can be altered, so
 * the table is rebuilt rather than patched.
 *
 * New schema adds:
 * - `enrichment TEXT` — JSON-serialized LlmEnrichment (nullable)
 * - `cached_at INTEGER` — Unix ms (replaces datetime)
 * - `refreshed_at INTEGER` — Unix ms, null until first refresh
 * - `UNIQUE(owner, repo)` — enables upsert via onConflict().merge()
 *
 * @param {import('knex').Knex} knex
 * @returns {Promise<void>}
 */
exports.up = async function up(knex) {
  // The guard is load-bearing, not defensive: with
  // `disableMigrationsListValidation` knex re-runs this against a database
  // whose recorded migration filenames differ from these, and a second
  // rebuild would drop an already-populated cache.
  if (await knex.schema.hasColumn('suggestions', 'enrichment')) {
    return;
  }

  await knex.schema.renameTable('suggestions', 'suggestions_old');

  await knex.schema.createTable('suggestions', table => {
    table.increments('id').primary();
    table.text('owner').notNullable();
    table.text('repo').notNullable();
    table.text('yaml').notNullable();
    table.text('signals_json').notNullable();
    table.text('enrichment').nullable();
    table.integer('cached_at').notNullable();
    table.integer('refreshed_at').nullable();
    table.unique(['owner', 'repo']);
  });

  await knex.schema.dropTableIfExists('suggestions_old');
};

/**
 * @param {import('knex').Knex} knex
 * @returns {Promise<void>}
 */
exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists('suggestions');
};
