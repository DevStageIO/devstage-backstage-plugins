/**
 * In-memory LRU cache for GitHub repository metadata (description, stars,
 * pushedAt). Bounded at 500 entries with a 1-hour TTL.
 *
 * LRU policy is implemented via Map insertion-order: on every cache hit the
 * key is deleted and re-inserted so it moves to the "most recently used" end.
 * On overflow the first (oldest) key in the Map is evicted.
 */

import { RepoMeta } from '../service/repoMetaFetcher';

const MAX_ENTRIES = 500;
const TTL_MS = 60 * 60 * 1000; // 1 hour

/**
 * A cached {@link RepoMeta}, stamped with the time it was stored.
 *
 * Only the three fields the coverage table always renders are required;
 * everything else is optional because a caller may cache what it happens to
 * know about a repo rather than a full GitHub response.
 */
export type RepoMetaEntry = Partial<RepoMeta> &
  Pick<RepoMeta, 'description' | 'stars' | 'pushedAt'> & { cachedAt: number };

/**
 * LRU cache for repository metadata fetched from the GitHub REST API.
 *
 * Key: `"{owner}/{repo}"` (lowercase-safe — callers must normalise if needed).
 * Injectable clock enables deterministic unit tests.
 */
export class RepoMetaCache {
  private readonly store = new Map<string, RepoMetaEntry>();

  constructor(private readonly now: () => number = () => Date.now()) {}

  /** Return cached entry if present and not expired; `undefined` otherwise. */
  get(owner: string, repo: string): RepoMetaEntry | undefined {
    const key = `${owner}/${repo}`;
    const entry = this.store.get(key);
    if (!entry) return undefined;

    if (this.now() - entry.cachedAt >= TTL_MS) {
      this.store.delete(key);
      return undefined;
    }

    // LRU promotion: move to end of insertion order
    this.store.delete(key);
    this.store.set(key, entry);
    return entry;
  }

  /** Store an entry, evicting the LRU entry when at capacity. */
  set(
    owner: string,
    repo: string,
    data: Omit<RepoMetaEntry, 'cachedAt'>,
  ): void {
    const key = `${owner}/${repo}`;

    // Remove stale entry first (so re-setting a key doesn't count as overflow)
    if (this.store.has(key)) {
      this.store.delete(key);
    }

    // Evict oldest (first) entry when at capacity
    if (this.store.size >= MAX_ENTRIES) {
      const oldest = this.store.keys().next().value;
      if (oldest !== undefined) {
        this.store.delete(oldest);
      }
    }

    this.store.set(key, { ...data, cachedAt: this.now() });
  }

  /** Current number of live entries (expired entries are NOT pre-counted). */
  get size(): number {
    return this.store.size;
  }
}
