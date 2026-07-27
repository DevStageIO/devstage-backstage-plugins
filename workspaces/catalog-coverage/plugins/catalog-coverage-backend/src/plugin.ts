import {
  coreServices,
  createBackendPlugin,
  DatabaseService,
  LoggerService,
  RootConfigService,
} from '@backstage/backend-plugin-api';
import { catalogServiceRef } from '@backstage/plugin-catalog-node';
import { createRouter } from './service/router';
import { FetchDefaultBranch } from './service/UrlProbe';
import { MIGRATIONS_DIR } from './services/migrationsDir';
import { SuggestionCache } from './services/SuggestionCache';
import { LLMAnalyzer } from './services/LLMAnalyzer';
import {
  resolveAllowedOwners,
  resolveGithubToken,
} from './service/tokenConfig';

const buildGithubFetchDefaultBranch = (
  token: string | undefined,
): FetchDefaultBranch | undefined => {
  if (!token) return undefined;
  return async (host, org, repo) => {
    const apiHost = host === 'github.com' ? 'api.github.com' : `${host}/api/v3`;
    const url = `https://${apiHost}/repos/${org}/${repo}`;
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });
    if (!response.ok) return undefined;
    const body = (await response.json()) as { default_branch?: string };
    return body.default_branch;
  };
};

/** Run knex migrations and return a ready SuggestionCache. */
const initSuggestionCache = async (
  database: DatabaseService,
  logger: LoggerService,
): Promise<SuggestionCache> => {
  const knex = await database.getClient();
  // A migration problem must NEVER crash the whole backend — one plugin's
  // init error otherwise takes down the entire app (Backstage re-throws the
  // settled rejection in #doStart). Observed in 2026-05: a database that
  // recorded these migrations under their old `.ts` filenames made knex throw
  // "migration directory is corrupt, missing 001_suggestions.ts" once they
  // were compiled to `.js`, and the deployment crash-looped. The suggestions
  // table is already present in that case, so degrade gracefully.
  try {
    // Validation is off deliberately, not as a shortcut: it compares recorded
    // filenames against the directory, so any database whose history predates
    // a file move is rejected as corrupt forever — which is exactly the
    // crash-loop above. Without it knex replays the files, and both are
    // written to be no-ops when their schema is already in place (see
    // migrationsDir.test.ts).
    await knex.migrate.latest({
      directory: MIGRATIONS_DIR,
      disableMigrationsListValidation: true,
    });
  } catch (error) {
    logger.warn(
      `catalog-coverage: suggestion-cache migration skipped (${
        (error as Error).message
      }). Continuing — table is assumed present or the in-memory cache is used.`,
    );
  }
  return new SuggestionCache(knex);
};

const readPrConfig = (config: RootConfigService) => ({
  defaultPrTitle:
    config.getOptionalString('catalogCoverage.pr.title') ?? undefined,
  defaultPrBody:
    config.getOptionalString('catalogCoverage.pr.body') ?? undefined,
});

const readPluginConfig = (config: RootConfigService) => {
  const ownerKind = config.getOptionalString(
    'catalogCoverage.defaultOwner.kind',
  );
  const ownerRef = config.getOptionalString('catalogCoverage.defaultOwner.ref');
  const defaultOwner =
    ownerKind && ownerRef ? { kind: ownerKind, ref: ownerRef } : undefined;
  const maxConcurrency =
    config.getOptionalNumber('catalogCoverage.maxConcurrency') ?? undefined;
  return { defaultOwner, maxConcurrency };
};

/**
 * `catalog-coverage` backend plugin.
 *
 * Projects Backstage catalog Locations into the per-repo coverage rows
 * consumed by the matching frontend plugin. No own database, no scheduler:
 * derives state on each request from the catalog plus a cached UrlReader
 * fallback for Locations whose join produced 0 children.
 *
 * Phase 3 adds persistent SQLite caching (SuggestionCache) and LLM enrichment
 * (LLMAnalyzer) so catalog-info suggestions survive backend restarts and
 * include AI-generated descriptions, types, and lifecycle classifications.
 *
 * E005 adds configurable PR message template (catalogCoverage.pr.*) and
 * cache TTL via CATALOG_COVERAGE_CACHE_TTL_DAYS env var (default 30 days).
 *
 * @public
 */
export const catalogCoverageBackendPlugin = createBackendPlugin({
  pluginId: 'catalog-coverage',
  register(env) {
    env.registerInit({
      deps: {
        httpRouter: coreServices.httpRouter,
        logger: coreServices.logger,
        auth: coreServices.auth,
        urlReader: coreServices.urlReader,
        catalog: catalogServiceRef,
        database: coreServices.database,
        config: coreServices.rootConfig,
      },
      async init({
        httpRouter,
        logger,
        auth,
        urlReader,
        catalog,
        database,
        config,
      }) {
        const suggestionCache = await initSuggestionCache(database, logger);

        const githubToken = resolveGithubToken(config);
        const allowedOwners = resolveAllowedOwners(config);
        const llmAnalyzer =
          process.env.OPENAI_API_KEY && githubToken
            ? new LLMAnalyzer(githubToken)
            : undefined;

        const { defaultPrTitle, defaultPrBody } = readPrConfig(config);
        const { defaultOwner, maxConcurrency } = readPluginConfig(config);

        const router = await createRouter({
          logger,
          auth,
          catalog,
          urlReader,
          githubToken,
          allowedOwners,
          fetchDefaultBranch: buildGithubFetchDefaultBranch(githubToken),
          suggestionCache,
          llmAnalyzer,
          defaultPrTitle,
          defaultPrBody,
          defaultOwner,
          maxConcurrency,
        });
        httpRouter.use(router);
        // Read routes are public; the mutating routes are additionally guarded
        // by an owner allowlist (see authz.ts / createRouter). See ADR-019.
        httpRouter.addAuthPolicy({ path: '/', allow: 'unauthenticated' });
      },
    });
  },
});

export default catalogCoverageBackendPlugin;
