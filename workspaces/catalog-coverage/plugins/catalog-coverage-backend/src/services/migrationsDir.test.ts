import knexFactory from 'knex';
import { MIGRATIONS_DIR } from './migrationsDir';

const migrate = (knex: ReturnType<typeof knexFactory>) =>
  knex.migrate.latest({
    directory: MIGRATIONS_DIR,
    disableMigrationsListValidation: true,
  });

const newDb = () =>
  knexFactory({
    client: 'better-sqlite3',
    connection: ':memory:',
    useNullAsDefault: true,
  });

describe('shipped migrations', () => {
  let knex: ReturnType<typeof newDb>;

  beforeEach(async () => {
    knex = newDb();
    await migrate(knex);
  });

  afterEach(async () => {
    await knex.destroy();
  });

  it('builds the final schema on a fresh database', async () => {
    expect(await knex.schema.hasTable('suggestions')).toBe(true);
    expect(await knex.schema.hasColumn('suggestions', 'enrichment')).toBe(true);
    expect(await knex.schema.hasTable('suggestions_old')).toBe(false);
  });

  it('replays without destroying data when history names no longer exist', async () => {
    // The 2026-05 crash-loop: a live database recorded these migrations under
    // filenames that later changed, so knex rejected the directory as corrupt
    // and the plugin took the whole backend down. Validation is now off, which
    // means the files are re-run instead — so they must be no-ops.
    await knex('suggestions').insert({
      owner: 'zentala',
      repo: 'backstage',
      yaml: 'kind: Component\n',
      signals_json: '{}',
      cached_at: 1700000000000,
    });
    await knex('knex_migrations').update({
      name: knex.raw("replace(name, '.js', '.ts')"),
    });

    await expect(migrate(knex)).resolves.toBeDefined();

    const rows = await knex('suggestions').select('owner', 'repo');
    expect(rows).toEqual([{ owner: 'zentala', repo: 'backstage' }]);
    expect(await knex.schema.hasColumn('suggestions', 'enrichment')).toBe(true);
    expect(await knex.schema.hasTable('suggestions_old')).toBe(false);
  });
});
