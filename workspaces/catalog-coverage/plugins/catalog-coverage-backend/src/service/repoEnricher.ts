/**
 * Per-repo enrichment: GitHub metadata, account type, taxonomy status and the
 * open-onboarding-PR lookup that flips `Missing` to `Waiting`.
 *
 * Split out of `repoBuilder` so that both the full sweep and the single-repo
 * resolve share one implementation and cannot drift apart.
 */

import { Repo } from '../types';
import { deriveRepoIssues, getProviderKind } from './repoIssues';
import { AccountTypeResolver } from '../services/accountTypeResolver';
import { RepoMetaCache } from '../services/repoMetaCache';
import { SchemaValidator } from '../services/SchemaValidator';
import { fetchGitHubRepoMeta, RepoMeta } from './repoMetaFetcher';
import { OpenPrLookup } from './openPrLookup';

/** Dependencies required to enrich a single projected repo. */
export type RepoEnricherDeps = {
  accountTypeResolver: AccountTypeResolver;
  repoMetaCache: RepoMetaCache;
  openPrLookup: OpenPrLookup;
  githubToken?: string;
};

/** Factory: returns `enrichRepo` bound to the provided deps. */
export const createRepoEnricher = (deps: RepoEnricherDeps) => {
  const { accountTypeResolver, repoMetaCache, openPrLookup, githubToken } =
    deps;
  const validator = new SchemaValidator();

  const fetchRepoMeta = async (
    org: string,
    repoName: string,
  ): Promise<RepoMeta | null> => {
    const cached = repoMetaCache.get(org, repoName);
    if (cached) {
      return {
        description: cached.description,
        topics: cached.topics ?? [],
        stars: cached.stars,
        pushedAt: cached.pushedAt,
        archived: cached.archived ?? false,
        visibility: cached.visibility ?? 'public',
        defaultBranch: cached.defaultBranch ?? 'main',
        commitCount: cached.commitCount,
      };
    }
    const meta = await fetchGitHubRepoMeta(org, repoName, githubToken);
    if (meta) repoMetaCache.set(org, repoName, meta);
    return meta;
  };

  const enrichRepo = async (repo: Repo, rawYaml?: string): Promise<Repo> => {
    const provider = getProviderKind(repo.htmlUrl);
    const accountType = repo.org
      ? await accountTypeResolver.resolve(repo.org)
      : 'Unknown';
    let { taxonomyStatus } = deriveRepoIssues(repo, rawYaml, validator);

    let description: string | null | undefined;
    let topics: Array<string> | undefined;
    let stars: number | undefined;
    let pushedAt: string | undefined;
    let archived: boolean | undefined;
    let visibility: 'public' | 'private' | 'internal' | undefined;
    let defaultBranch: string | undefined;
    let commitCount: number | undefined;
    let prUrl: string | undefined;

    if (repo.org && repo.name && provider === 'github') {
      const meta = await fetchRepoMeta(repo.org, repo.name);
      if (meta) {
        description = meta.description;
        topics = meta.topics;
        stars = meta.stars;
        pushedAt = meta.pushedAt;
        archived = meta.archived;
        visibility = meta.visibility;
        defaultBranch = meta.defaultBranch;
        commitCount = meta.commitCount;
      }

      if (taxonomyStatus.kind === 'Missing') {
        const openPr = await openPrLookup.findOpenOnboardingPr(
          repo.org,
          repo.name,
        );
        if (openPr) {
          taxonomyStatus = { kind: 'Waiting' };
          prUrl = openPr;
        }
      }
    }

    return {
      ...repo,
      provider,
      accountType,
      taxonomyStatus,
      description,
      topics,
      stars,
      pushedAt,
      archived,
      visibility,
      defaultBranch,
      commitCount,
      links: repo.links
        ? { ...repo.links, ...(prUrl ? { prUrl } : {}) }
        : undefined,
    };
  };

  return { enrichRepo };
};
