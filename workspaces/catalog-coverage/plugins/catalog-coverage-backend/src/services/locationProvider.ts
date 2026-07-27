/**
 * LocationProvider abstraction for host-specific URL handling.
 *
 * Each provider knows how to:
 * - Identify URLs that belong to its host
 * - Parse repo coordinates from a catalog-info blob URL
 * - Generate action URLs (view YAML, create YAML, open repo, user/org page)
 *
 * New VCS hosts (GitLab, Bitbucket, Azure DevOps) implement `LocationProvider`
 * and register via `PROVIDERS`. Pure URL logic — no network calls.
 */

import { InputError } from '@backstage/errors';

/** Parsed repository coordinates extracted from a blob/tree URL. */
export type ParsedRepo = {
  owner: string;
  repo: string;
  branch: string;
};

/**
 * Host-specific URL handler. Implementations must be stateless and pure.
 *
 * Methods that are not yet implemented by a stub MUST throw `InputError`
 * (not `NotImplementedError`) so callers can catch it consistently.
 */
export interface LocationProvider {
  /**
   * Returns `true` when this provider handles the given URL's hostname.
   * Called first — if it returns `false`, the next provider is tried.
   */
  hostMatches(url: string): boolean;

  /**
   * Extract `{ owner, repo, branch }` from a blob URL.
   * Returns `null` for any URL that cannot be parsed (non-blob, malformed).
   */
  parseRepoUrl(url: string): ParsedRepo | null;

  /**
   * URL where users can view the `catalog-info.yaml` file on the web.
   * Returns `null` when the provider is a stub without a real implementation.
   */
  getViewYamlUrl(parsed: ParsedRepo, branch: string): string | null;

  /**
   * URL that opens the "new file" editor pre-filled with `catalog-info.yaml`.
   * Returns `null` when the provider is a stub without a real implementation.
   */
  getCreateYamlUrl(parsed: ParsedRepo, branch: string): string | null;

  /**
   * URL pointing to the repository root (e.g. `https://github.com/owner/repo`).
   * Returns `null` when the provider is a stub without a real implementation.
   */
  getRepoApiUrl(parsed: ParsedRepo): string | null;

  /**
   * URL pointing to a user or org profile page.
   * Returns `null` when the provider is a stub without a real implementation.
   */
  getUserOrOrgUrl(name: string): string | null;
}

// ---------------------------------------------------------------------------
// GitHub implementation
// ---------------------------------------------------------------------------

const GITHUB_HOSTNAME = 'github.com';

/** Handles `github.com` URLs. All six methods are fully implemented. */
export class GithubLocationProvider implements LocationProvider {
  /** @inheritdoc */
  hostMatches(url: string): boolean {
    try {
      return new URL(url).hostname === GITHUB_HOSTNAME;
    } catch {
      return false;
    }
  }

  /** @inheritdoc */
  parseRepoUrl(url: string): ParsedRepo | null {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return null;
    }
    if (parsed.hostname !== GITHUB_HOSTNAME) return null;
    // Normalise: strip trailing slash, strip `.git` suffix
    const clean = parsed.pathname.replace(/\.git$/, '').replace(/\/$/, '');
    const segments = clean.split('/').filter(Boolean);
    // blob URL:  /owner/repo/blob/branch/...path
    // tree URL:  /owner/repo/tree/branch/...path
    // bare URL:  /owner/repo  (2 segments)
    if (segments.length < 2) return null;
    const [owner, repo, verb, branch] = segments;
    if (verb && verb !== 'blob' && verb !== 'tree') return null;
    return {
      owner,
      repo,
      branch: branch ?? 'main',
    };
  }

  /** @inheritdoc */
  getViewYamlUrl(parsed: ParsedRepo, branch: string): string {
    return `https://github.com/${parsed.owner}/${parsed.repo}/blob/${branch}/catalog-info.yaml`;
  }

  /** @inheritdoc */
  getCreateYamlUrl(parsed: ParsedRepo, branch: string): string {
    return `https://github.com/${parsed.owner}/${parsed.repo}/new/${branch}?filename=catalog-info.yaml`;
  }

  /** @inheritdoc */
  getRepoApiUrl(parsed: ParsedRepo): string {
    return `https://github.com/${parsed.owner}/${parsed.repo}`;
  }

  /** @inheritdoc */
  getUserOrOrgUrl(name: string): string {
    return `https://github.com/${name}`;
  }
}

// ---------------------------------------------------------------------------
// GitLab stub — Phase 4 will replace with a real implementation
// ---------------------------------------------------------------------------

const GITLAB_HOST_RE = /^gitlab\./i;

/**
 * Stub for GitLab URLs. `hostMatches` and `parseRepoUrl` work correctly;
 * URL-generation methods return `null` until Phase 4.
 */
export class GitLabLocationProvider implements LocationProvider {
  /** @inheritdoc */
  hostMatches(url: string): boolean {
    try {
      const { hostname } = new URL(url);
      return hostname === 'gitlab.com' || GITLAB_HOST_RE.test(hostname);
    } catch {
      return false;
    }
  }

  /** @inheritdoc */
  parseRepoUrl(url: string): ParsedRepo | null {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return null;
    }
    if (!this.hostMatches(url)) return null;
    // GitLab blob paths:  /owner/repo/-/blob/branch/...
    const clean = parsed.pathname.replace(/\.git$/, '').replace(/\/$/, '');
    const segments = clean.split('/').filter(Boolean);
    if (segments.length < 2) return null;
    const [owner, repo, dash, verb, branch] = segments;
    if (dash === '-' && (verb === 'blob' || verb === 'tree') && branch) {
      return { owner, repo, branch };
    }
    // Bare /owner/repo URL
    if (segments.length === 2) {
      return { owner, repo, branch: 'main' };
    }
    return null;
  }

  /** @inheritdoc — stub: not yet implemented */
  getViewYamlUrl(_parsed: ParsedRepo, _branch: string): null {
    return null;
  }

  /** @inheritdoc — stub: not yet implemented */
  getCreateYamlUrl(_parsed: ParsedRepo, _branch: string): null {
    return null;
  }

  /** @inheritdoc — stub: not yet implemented */
  getRepoApiUrl(_parsed: ParsedRepo): null {
    return null;
  }

  /** @inheritdoc — stub: not yet implemented */
  getUserOrOrgUrl(_name: string): null {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Registry + factory
// ---------------------------------------------------------------------------

/** Ordered list of all registered providers. First match wins. */
const PROVIDERS: Array<LocationProvider> = [
  new GithubLocationProvider(),
  new GitLabLocationProvider(),
];

/**
 * Return the first `LocationProvider` whose `hostMatches(url)` returns `true`,
 * or `null` when no provider recognises the URL.
 */
export const findProvider = (url: string): LocationProvider | null => {
  for (const provider of PROVIDERS) {
    if (provider.hostMatches(url)) return provider;
  }
  return null;
};

// Re-export InputError so callers can catch it without a separate import.
export { InputError };
