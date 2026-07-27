import knexFactory from 'knex';
import { MIGRATIONS_DIR } from './migrationsDir';
import { SuggestionCache, CachedSuggestion } from './SuggestionCache';
import { LlmEnrichment } from './LLMAnalyzer';

const makeSuggestion = (
  overrides?: Partial<CachedSuggestion>,
): CachedSuggestion => ({
  repoKey: 'zentala/my-repo',
  yaml: 'apiVersion: backstage.io/v1alpha1\nkind: Component\n',
  signalsJson: '{"hasDockerfile":true}',
  cachedAt: 1700000000000,
  ...overrides,
});

const ENRICHMENT: LlmEnrichment = {
  description: 'A test repository for catalog-info suggestions.',
  type: 'library',
  lifecycle: 'development',
  tags: [],
};

describe('SuggestionCache', () => {
  let knex: ReturnType<typeof knexFactory>;
  let cache: SuggestionCache;

  beforeAll(async () => {
    knex = knexFactory({
      client: 'better-sqlite3',
      connection: ':memory:',
      useNullAsDefault: true,
    });
    // Same directory and same options as production (plugin.ts) — a
    // CWD-relative path here is what previously let the two diverge.
    await knex.migrate.latest({
      directory: MIGRATIONS_DIR,
      disableMigrationsListValidation: true,
    });
  });

  afterAll(async () => {
    await knex.destroy();
  });

  beforeEach(async () => {
    await knex('suggestions').delete();
    cache = new SuggestionCache(knex);
  });

  it('returns undefined for a cache miss', async () => {
    const result = await cache.get('zentala/unknown-repo');
    expect(result).toBeUndefined();
  });

  it('stores and retrieves a suggestion', async () => {
    const suggestion = makeSuggestion();
    await cache.set('zentala/my-repo', suggestion);

    const result = await cache.get('zentala/my-repo');
    expect(result).toBeDefined();
    expect(result?.repoKey).toBe('zentala/my-repo');
    expect(result?.yaml).toBe(suggestion.yaml);
    expect(result?.signalsJson).toBe(suggestion.signalsJson);
    expect(result?.cachedAt).toBe(suggestion.cachedAt);
  });

  it('stores and retrieves enrichment', async () => {
    const suggestion = makeSuggestion({ enrichment: ENRICHMENT });
    await cache.set('zentala/my-repo', suggestion);

    const result = await cache.get('zentala/my-repo');
    expect(result?.enrichment).toEqual(ENRICHMENT);
  });

  it('stores suggestion with no enrichment (null)', async () => {
    const suggestion = makeSuggestion({ enrichment: undefined });
    await cache.set('zentala/my-repo', suggestion);

    const result = await cache.get('zentala/my-repo');
    expect(result?.enrichment).toBeUndefined();
  });

  it('upserts on second set() for same repo — no duplicate rows', async () => {
    await cache.set('zentala/my-repo', makeSuggestion({ cachedAt: 1000 }));
    await cache.set(
      'zentala/my-repo',
      makeSuggestion({ cachedAt: 2000, enrichment: ENRICHMENT }),
    );

    const rows = await knex('suggestions').where({
      owner: 'zentala',
      repo: 'my-repo',
    });
    expect(rows).toHaveLength(1);

    const result = await cache.get('zentala/my-repo');
    expect(result?.cachedAt).toBe(2000);
    expect(result?.enrichment).toEqual(ENRICHMENT);
  });

  it('invalidates an entry', async () => {
    await cache.set('zentala/my-repo', makeSuggestion());
    await cache.invalidate('zentala/my-repo');

    const result = await cache.get('zentala/my-repo');
    expect(result).toBeUndefined();
  });

  it('invalidate is a no-op for missing entry', async () => {
    await expect(
      cache.invalidate('zentala/nonexistent'),
    ).resolves.not.toThrow();
  });

  it('handles multiple repos independently', async () => {
    await cache.set(
      'owner-a/repo-1',
      makeSuggestion({ repoKey: 'owner-a/repo-1' }),
    );
    await cache.set(
      'owner-b/repo-2',
      makeSuggestion({ repoKey: 'owner-b/repo-2' }),
    );

    const r1 = await cache.get('owner-a/repo-1');
    const r2 = await cache.get('owner-b/repo-2');
    const r3 = await cache.get('owner-c/repo-3');

    expect(r1?.repoKey).toBe('owner-a/repo-1');
    expect(r2?.repoKey).toBe('owner-b/repo-2');
    expect(r3).toBeUndefined();
  });

  it('stores and retrieves refreshedAt timestamp', async () => {
    const suggestion = makeSuggestion({ refreshedAt: 1700000099999 });
    await cache.set('zentala/my-repo', suggestion);

    const result = await cache.get('zentala/my-repo');
    expect(result?.refreshedAt).toBe(1700000099999);
  });
});
