/**
 * AccountTypeResolver — resolves whether a GitHub owner is a User or
 * Organization. Results are cached in-memory for 24 hours.
 *
 * Uses the GitHub REST API `GET /users/{owner}` which returns `type: "User"`
 * or `type: "Organization"` for any public account.
 */

import { AccountType } from '../types';

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
/** The `type` values GitHub reports that we recognise; anything else is Unknown. */
const KNOWN_ACCOUNT_TYPES: Array<AccountType> = ['Organization', 'User'];
/** Hard cap on distinct owners cached; oldest entry evicted past this. */
const MAX_ENTRIES = 500;

type CacheEntry = {
  type: AccountType;
  cachedAt: number;
};

/** Minimal GitHub /users response shape we care about. */
type GitHubUserResponse = {
  type: string;
};

/**
 * Resolves and caches `accountType` for GitHub owner names.
 * Singleton: instantiate once per router and pass through.
 */
export class AccountTypeResolver {
  private readonly cache = new Map<string, CacheEntry>();
  private readonly githubToken: string | undefined;

  constructor(githubToken?: string) {
    this.githubToken = githubToken;
  }

  /** Return cached value if still within TTL. */
  private getCached(owner: string): AccountType | undefined {
    const entry = this.cache.get(owner);
    if (!entry) return undefined;
    if (Date.now() - entry.cachedAt > CACHE_TTL_MS) {
      this.cache.delete(owner);
      return undefined;
    }
    return entry.type;
  }

  private setCached(owner: string, type: AccountType): void {
    if (this.cache.size >= MAX_ENTRIES && !this.cache.has(owner)) {
      const oldest = this.cache.keys().next().value;
      if (oldest !== undefined) this.cache.delete(oldest);
    }
    this.cache.set(owner, { type, cachedAt: Date.now() });
  }

  /**
   * Resolve the account type for a GitHub owner.
   * Returns `'Unknown'` on any network error or unrecognised type string.
   */
  async resolve(owner: string): Promise<AccountType> {
    const cached = this.getCached(owner);
    if (cached !== undefined) return cached;

    try {
      const headers: Record<string, string> = {
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      };
      if (this.githubToken) {
        headers.Authorization = `Bearer ${this.githubToken}`;
      }
      const res = await fetch(
        `https://api.github.com/users/${encodeURIComponent(owner)}`,
        {
          headers,
        },
      );
      if (!res.ok) {
        this.setCached(owner, 'Unknown');
        return 'Unknown';
      }
      const data = (await res.json()) as GitHubUserResponse;
      const type: AccountType = KNOWN_ACCOUNT_TYPES.includes(
        data.type as AccountType,
      )
        ? (data.type as AccountType)
        : 'Unknown';
      this.setCached(owner, type);
      return type;
    } catch {
      this.setCached(owner, 'Unknown');
      return 'Unknown';
    }
  }
}
