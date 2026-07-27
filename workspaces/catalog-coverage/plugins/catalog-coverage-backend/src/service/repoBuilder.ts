/**
 * Repository enrichment and aggregation for the catalog-coverage-backend router.
 *
 * Exports:
 *  - `createRepoBuilder` factory: given router-level deps, returns
 *    `buildAllRepos` (the full dashboard sweep) and `buildRepo` (one row,
 *    scoped to that repo's own catalog and GitHub requests).
 *  - `RepoBuilderDeps`: dependency bag accepted by the factory.
 */

import { AuthService, LoggerService } from '@backstage/backend-plugin-api';
import { CatalogService } from '@backstage/plugin-catalog-node';
import pLimit from 'p-limit';
import { Repo } from '../types';
import {
  ORIGIN_ANNOTATION,
  ProjectedRepo,
  projectLocations,
} from './LocationProjector';
import { UrlProbe } from './UrlProbe';
import { getProviderKind } from './repoIssues';
import { AccountTypeResolver } from '../services/accountTypeResolver';
import { RepoMetaCache } from '../services/repoMetaCache';
import { fetchGitHubRepoMeta } from './repoMetaFetcher';
import { createOpenPrLookup, OpenPrLookup } from './openPrLookup';
import { createRepoEnricher } from './repoEnricher';

/**
 * Default cap on simultaneous outbound GitHub requests during a sweep.
 *
 * GitHub's secondary rate limit targets parallelism, and the token is shared
 * with catalog discovery and the other plugins in this portal — an unbounded
 * burst here would throttle them too.
 */
export const DEFAULT_MAX_CONCURRENCY = 8;

export { fetchGitHubRepoMeta, getProviderKind };

/** Identifies one row of the coverage table, as addressed by the router. */
export type RepoSelector = {
  host: string;
  org: string;
  name: string;
  path: string;
};

/** Dependencies required by the repo builder functions. */
export type RepoBuilderDeps = {
  auth: AuthService;
  catalog: CatalogService;
  logger: LoggerService;
  probe: UrlProbe;
  accountTypeResolver: AccountTypeResolver;
  repoMetaCache: RepoMetaCache;
  /** GitHub token resolved from config/env by the router. */
  githubToken?: string;
  /** Cap on simultaneous outbound GitHub requests. Defaults to 8. */
  maxConcurrency?: number;
  /** Injectable open-PR lookup; a TTL-memoised one is created when omitted. */
  openPrLookup?: OpenPrLookup;
};

const matchesSelector = (repo: Repo, selector: RepoSelector): boolean =>
  repo.host === selector.host &&
  repo.org === selector.org &&
  repo.name === selector.name &&
  repo.path === selector.path;

const locationTarget = (location: { spec?: unknown }): string => {
  const target = (location.spec as Record<string, unknown> | undefined)?.target;
  return typeof target === 'string' ? target : '';
};

/**
 * Factory: returns the repo builder functions bound to the provided deps.
 *
 * Separating the factory from the router keeps the deps out of the module
 * scope and makes unit testing straightforward.
 */
export const createRepoBuilder = (deps: RepoBuilderDeps) => {
  const {
    auth,
    catalog,
    logger,
    probe,
    accountTypeResolver,
    repoMetaCache,
    githubToken,
    maxConcurrency = DEFAULT_MAX_CONCURRENCY,
    openPrLookup = createOpenPrLookup({ githubToken }),
  } = deps;
  const { enrichRepo } = createRepoEnricher({
    accountTypeResolver,
    repoMetaCache,
    openPrLookup,
    githubToken,
  });
  // One budget shared by both fan-outs, so probe and enrich phases cannot each
  // open `maxConcurrency` sockets of their own.
  const limit = pLimit(maxConcurrency);

  const probeProjected = ({
    repo,
    needsProbe,
  }: ProjectedRepo): Promise<[Repo, string | undefined]> =>
    limit(async (): Promise<[Repo, string | undefined]> => {
      if (!needsProbe) return [repo, undefined];
      try {
        const probeResult = await probe.probe(repo.htmlUrl);
        return [
          {
            ...repo,
            status: probeResult.status,
            branchMismatch: probeResult.branchMismatch,
            lastSeen: new Date(probeResult.cachedAt).toISOString(),
          },
          probeResult.rawYaml,
        ];
      } catch (err) {
        logger.warn(
          `Probe error for ${repo.locationRef}: ${(err as Error).message}`,
        );
        return [repo, undefined];
      }
    });

  /**
   * Enrich probed rows, settling rather than all-or-nothing: one repo's GitHub
   * failure must degrade that row only, not empty the whole table.
   */
  const enrichAll = async (
    probedPairs: Array<[Repo, string | undefined]>,
  ): Promise<Array<Repo>> => {
    const enriched = await Promise.allSettled(
      probedPairs.map(([repo, rawYaml]) =>
        limit(() => enrichRepo(repo, rawYaml)),
      ),
    );

    return enriched.map((outcome, index) => {
      if (outcome.status === 'fulfilled') return outcome.value;
      const [repo] = probedPairs[index];
      logger.warn(
        `Enrich error for ${repo.locationRef}: ${
          outcome.reason?.message ?? outcome.reason
        }`,
      );
      return { ...repo, provider: getProviderKind(repo.htmlUrl) };
    });
  };

  const buildAllRepos = async (): Promise<Array<Repo>> => {
    const credentials = await auth.getOwnServiceCredentials();
    const [locationsResponse, allEntitiesResponse] = await Promise.all([
      catalog.getEntities({ filter: { kind: 'Location' } }, { credentials }),
      catalog.getEntities({}, { credentials }),
    ]);
    const children = allEntitiesResponse.items.filter(
      e => e.kind !== 'Location',
    );
    // Filter out Locations whose target URL couldn't be parsed (file-based, local, non-GitHub).
    const projected = projectLocations(
      locationsResponse.items,
      children,
    ).filter(({ repo }) => !!repo.host);

    const probedPairs = await Promise.all(projected.map(probeProjected));
    return enrichAll(probedPairs);
  };

  /**
   * Resolve a single row without sweeping the fleet: probes and enriches
   * exactly one repo, and joins its children with a catalog query scoped to
   * that Location's target instead of fetching every entity.
   *
   * Returns `undefined` when no Location projects to the given selector.
   */
  const buildRepo = async (
    selector: RepoSelector,
  ): Promise<Repo | undefined> => {
    const credentials = await auth.getOwnServiceCredentials();
    const locationsResponse = await catalog.getEntities(
      { filter: { kind: 'Location' } },
      { credentials },
    );
    // Identity (host/org/name/path) is derived from the Location target alone,
    // so the child join can wait until we know which Location to join against.
    const index = projectLocations(locationsResponse.items, []).findIndex(
      ({ repo }) => matchesSelector(repo, selector),
    );
    if (index < 0) return undefined;

    const location = locationsResponse.items[index];
    const target = locationTarget(location);
    const childrenResponse = await catalog.getEntities(
      {
        filter: {
          // Ingestion writes the annotation with or without the `url:` prefix
          // depending on provider; an array value matches either.
          [`metadata.annotations.${ORIGIN_ANNOTATION}`]: [
            target,
            `url:${target}`,
          ],
        },
      },
      { credentials },
    );
    const children = childrenResponse.items.filter(e => e.kind !== 'Location');

    const [projected] = projectLocations([location], children);
    const [enriched] = await enrichAll([await probeProjected(projected)]);
    return enriched;
  };

  return { buildAllRepos, buildRepo };
};
