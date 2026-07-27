// @ts-check

/**
 * Knex migration 001: create the `suggestions` cache table.
 *
 * Cache key: (owner, repo). Superseded by 002, which rebuilds this table with
 * the columns the persistent cache actually uses — 001 is kept so a database
 * created before 002 still replays the same history.
 *
 * Plain CommonJS at the package root (upstream Backstage convention): knex
 * loads migration files directly at runtime, so they must be shippable without
 * a build step. See E015-T08.
 *
 * @param {import('knex').Knex} knex
 * @returns {Promise<void>}
 */
exports.up = async function up(knex) {
  // Idempotent because `disableMigrationsListValidation` lets knex re-run this
  // against a database whose recorded migration filenames differ from these.
  if (await knex.schema.hasTable('suggestions')) {
    return;
  }

  await knex.schema.createTable('suggestions', table => {
    table.increments('id').primary();
    table.text('owner').notNullable();
    table.text('repo').notNullable();
    table.text('readme_sha').nullable();
    table.text('yaml').notNullable();
    table.text('signals_json').notNullable();
    table.datetime('cached_at').notNullable();
    table.datetime('expires_at').notNullable();
    table.index(['owner', 'repo'], 'idx_suggestions_owner_repo');
  });
};

/**
 * @param {import('knex').Knex} knex
 * @returns {Promise<void>}
 */
exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists('suggestions');
};
