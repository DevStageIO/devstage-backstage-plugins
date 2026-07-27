/**
 * GitHub fetch helpers and YAML-building utilities used by HeuristicAnalyzer.
 * Separated out to keep HeuristicAnalyzer.ts under the 250-line limit.
 */

import * as yaml from 'js-yaml';
import { RepoMeta as FullRepoMeta } from '../service/repoMetaFetcher';
import { GITHUB_API, buildReadHeaders } from '../service/githubClient';

/**
 * Owner written into a generated suggestion when `catalogCoverage.defaultOwner`
 * is not configured. A suggestion is edited before it is committed, so an
 * explicit TODO is the honest default — inventing an owner would write a wrong
 * one into someone else's repository.
 */
export const FALLBACK_OWNER = 'TODO: a Group or User in your catalog';

/** Maximum characters extracted from a README for LLM enrichment. */
export const README_EXCERPT_MAX_CHARS = 2000;

/** GitHub's raw-content Accept header, used for file and README fetches. */
const RAW_ACCEPT = 'application/vnd.github.raw';

/**
 * The subset of {@link FullRepoMeta} that a single `GET /repos/{owner}/{repo}`
 * returns — no commit-count pagination, no visibility. `pushedAt` is nullable
 * here because the suggestion path also runs against repos with no commits.
 */
export type RepoMeta = Pick<
  FullRepoMeta,
  'stars' | 'archived' | 'defaultBranch' | 'topics' | 'description'
> & { pushedAt: string | null };

/** Fetch raw file content from GitHub (returns null on 404 or network error). */
export const fetchFile = async (
  owner: string,
  repo: string,
  path: string,
  token: string | undefined,
): Promise<string | null> => {
  const headers = { ...buildReadHeaders(token), Accept: RAW_ACCEPT };
  try {
    const url = `${GITHUB_API}/repos/${owner}/${repo}/contents/${path}`;
    const res = await fetch(url, { headers });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
};

/** Fetch basic repo metadata (stars, archived, default branch). */
export const fetchRepoMeta = async (
  owner: string,
  repo: string,
  token: string | undefined,
): Promise<RepoMeta | null> => {
  const headers = buildReadHeaders(token);
  try {
    const res = await fetch(`${GITHUB_API}/repos/${owner}/${repo}`, {
      headers,
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      stargazers_count: number;
      archived: boolean;
      default_branch: string;
      topics?: Array<string>;
      description: string | null;
      pushed_at: string | null;
    };
    return {
      stars: data.stargazers_count,
      archived: data.archived,
      defaultBranch: data.default_branch,
      topics: data.topics ?? [],
      description: data.description ?? null,
      pushedAt: data.pushed_at ?? null,
    };
  } catch {
    return null;
  }
};

/** Extract package name from package.json content (strips npm scope). */
export const parsePackageName = (raw: string): string | undefined => {
  try {
    const pkg = JSON.parse(raw) as Record<string, unknown>;
    if (typeof pkg.name !== 'string') return undefined;
    return pkg.name.replace(/^@[^/]+\//, '');
  } catch {
    return undefined;
  }
};

/** Extract package name from Cargo.toml content. */
export const parseCargoName = (raw: string): string | undefined => {
  const match = raw.match(/^\s*name\s*=\s*"([^"]+)"/m);
  return match?.[1];
};

/** Convert a string to kebab-case. */
export const toKebab = (s: string): string =>
  s
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/[_\s]+/g, '-')
    .toLowerCase();

/**
 * Fetch the repository README and return the first {@link README_EXCERPT_MAX_CHARS}
 * characters. Uses the dedicated `/readme` endpoint which resolves filename case
 * automatically (README.md, readme.md, README.rst, etc.).
 *
 * Returns `null` if the repo has no README or the request fails.
 */
export const fetchReadmeExcerpt = async (
  owner: string,
  repo: string,
  token: string | undefined,
): Promise<string | null> => {
  const headers = { ...buildReadHeaders(token), Accept: RAW_ACCEPT };
  try {
    const url = `${GITHUB_API}/repos/${owner}/${repo}/readme`;
    const res = await fetch(url, { headers });
    if (!res.ok) return null;
    const text = await res.text();
    return text.slice(0, README_EXCERPT_MAX_CHARS);
  } catch {
    return null;
  }
};

/** Build YAML string, injecting TODO comments for ambiguous fields. */
export const buildYaml = (
  owner: string,
  repo: string,
  name: string,
  type: string | 'ambiguous',
  lifecycle: string,
  ownerRef: string = FALLBACK_OWNER,
): string => {
  const typeComment = '# TODO: pick one — service|library|website';

  const doc: Record<string, unknown> = {
    apiVersion: 'backstage.io/v1alpha1',
    kind: 'Component',
    metadata: {
      name,
      description: 'TODO: Add description',
      annotations: {
        'github.com/project-slug': `${owner}/${repo}`,
        'backstage.io/source-location': `url:https://github.com/${owner}/${repo}/`,
      },
    },
    spec: {
      type: type === 'ambiguous' ? 'service' : type,
      lifecycle,
      owner: ownerRef,
    },
  };

  let yamlStr = yaml.dump(doc, { lineWidth: 120 });

  if (type === 'ambiguous') {
    yamlStr = yamlStr.replace(
      /^(\s+type:\s+service)$/m,
      `  type: service  ${typeComment}`,
    );
  }

  return yamlStr;
};
