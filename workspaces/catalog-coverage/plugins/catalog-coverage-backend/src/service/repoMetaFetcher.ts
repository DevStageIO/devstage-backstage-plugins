/**
 * GitHub REST API fetcher for repository metadata.
 *
 * Fires two parallel requests per repo:
 *  1. GET /repos/{org}/{repo}  — description, topics, stars, pushedAt, archived, visibility, default_branch, forks_count
 *  2. GET /repos/{org}/{repo}/commits?per_page=1  — commit count (via Link header pagination)
 */
import { GITHUB_API, buildReadHeaders } from './githubClient';

/**
 * Canonical GitHub repository metadata for this plugin. The two narrower
 * shapes — {@link ../services/HeuristicFetchers!RepoMeta} (what the suggestion
 * path fetches) and {@link ../services/repoMetaCache!RepoMetaEntry} (what the
 * LRU cache holds) — are derived from this type rather than redeclared, so a
 * field is described in exactly one place.
 */
export type RepoMeta = {
  description: string | null;
  topics: Array<string>;
  stars: number;
  forks?: number;
  pushedAt: string;
  archived: boolean;
  /** Repository visibility: public, private, or internal (org-wide on GitHub Enterprise). */
  visibility: 'public' | 'private' | 'internal';
  /** GitHub default branch name. */
  defaultBranch: string;
  /** Total commit count on the default branch parsed from Link header pagination. */
  commitCount?: number;
};

/**
 * Parse total commit count from the GitHub Link header.
 * With per_page=1: rel="last" page number = total commits.
 * No Link header means there is exactly 1 commit.
 */
export const parseCommitCount = (
  linkHeader: string | null,
): number | undefined => {
  if (!linkHeader) return 1;
  const match = linkHeader.match(/[?&]page=(\d+)>;\s*rel="last"/);
  return match ? parseInt(match[1], 10) : undefined;
};

/** Fetch repo metadata from GitHub REST API. Returns null on any error. */
export const fetchGitHubRepoMeta = async (
  org: string,
  repo: string,
  token: string | undefined,
): Promise<RepoMeta | null> => {
  const headers = buildReadHeaders(token);
  try {
    const [metaRes, commitsRes] = await Promise.all([
      fetch(
        `${GITHUB_API}/repos/${encodeURIComponent(org)}/${encodeURIComponent(
          repo,
        )}`,
        { headers },
      ),
      fetch(
        `${GITHUB_API}/repos/${encodeURIComponent(org)}/${encodeURIComponent(
          repo,
        )}/commits?per_page=1`,
        { headers },
      ),
    ]);
    if (!metaRes.ok) {
      commitsRes.body?.cancel();
      return null;
    }
    const data = (await metaRes.json()) as {
      description: string | null;
      topics: string[];
      stargazers_count: number;
      forks_count: number;
      pushed_at: string;
      archived: boolean;
      visibility: 'public' | 'private' | 'internal';
      default_branch: string;
    };
    const commitCount = commitsRes.ok
      ? parseCommitCount(commitsRes.headers.get('Link'))
      : undefined;
    commitsRes.body?.cancel();
    return {
      description: data.description ?? null,
      topics: data.topics ?? [],
      stars: data.stargazers_count ?? 0,
      forks: data.forks_count ?? 0,
      pushedAt: data.pushed_at ?? '',
      archived: data.archived ?? false,
      visibility: data.visibility ?? 'public',
      defaultBranch: data.default_branch ?? 'main',
      commitCount,
    };
  } catch {
    return null;
  }
};
