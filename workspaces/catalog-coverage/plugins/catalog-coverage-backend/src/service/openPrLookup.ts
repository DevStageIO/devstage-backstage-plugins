/**
 * Lookup for an open onboarding pull request on a GitHub repository.
 *
 * A repo classified `Missing` may already have an onboarding PR in flight, in
 * which case it is really `Waiting`. Resolving that costs one GitHub request
 * per missing repo, and a single page session re-resolves the same repos
 * repeatedly (refresh, re-sweep). The lookup is therefore memoised for a short
 * TTL — long enough to collapse a sweep's worth of duplicates, short enough
 * that a user who just opened a PR sees it on their next refresh.
 *
 * The in-flight promise is cached rather than its result, so concurrent lookups
 * for the same repo also collapse to a single request.
 */

import { buildReadHeaders, GITHUB_API } from './githubClient';

/** Branch name used by the onboarding flow when opening a catalog-info PR. */
export const ONBOARD_BRANCH = 'backstage-integration';

const DEFAULT_TTL_MS = 60_000;
const REQUEST_TIMEOUT_MS = 5000;

export type OpenPrLookupOptions = {
  /** GitHub token; unauthenticated requests are allowed but heavily rate-limited. */
  githubToken?: string;
  /** Memoisation window. Defaults to 60s. */
  ttlMs?: number;
  /** Injectable clock, for tests. */
  now?: () => number;
};

export type OpenPrLookup = {
  /** Resolves the PR's html_url, or undefined when there is no open onboarding PR. */
  findOpenOnboardingPr: (
    org: string,
    repo: string,
  ) => Promise<string | undefined>;
};

/**
 * Creates a TTL-memoised open-PR lookup.
 *
 * Never rejects: network errors, timeouts, and non-OK responses all resolve to
 * `undefined`. The caller treats "no PR found" and "could not check" the same
 * way, so surfacing the difference would only add a failure mode to the sweep.
 */
export const createOpenPrLookup = (
  options: OpenPrLookupOptions = {},
): OpenPrLookup => {
  const {
    githubToken,
    ttlMs = DEFAULT_TTL_MS,
    now = () => Date.now(),
  } = options;

  const cache = new Map<
    string,
    { expiresAt: number; result: Promise<string | undefined> }
  >();

  const fetchOpenPrUrl = async (
    org: string,
    repo: string,
  ): Promise<string | undefined> => {
    const headers = buildReadHeaders(githubToken);
    const controller = new AbortController();
    const abortTimer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const url =
        `${GITHUB_API}/repos/${encodeURIComponent(org)}/${encodeURIComponent(
          repo,
        )}` +
        `/pulls?head=${encodeURIComponent(org)}:${ONBOARD_BRANCH}&state=open`;
      const response = await fetch(url, { headers, signal: controller.signal });
      if (!response.ok) return undefined;
      const prs = (await response.json()) as Array<{ html_url: string }>;
      return prs.length > 0 ? prs[0].html_url : undefined;
    } catch {
      return undefined; // best-effort: treat errors and timeouts as "no PR"
    } finally {
      clearTimeout(abortTimer);
    }
  };

  const findOpenOnboardingPr = (org: string, repo: string) => {
    const key = `${org}/${repo}`;
    const cached = cache.get(key);
    if (cached && cached.expiresAt > now()) return cached.result;

    const result = fetchOpenPrUrl(org, repo);
    cache.set(key, { expiresAt: now() + ttlMs, result });
    return result;
  };

  return { findOpenOnboardingPr };
};
