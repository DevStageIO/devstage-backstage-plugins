/**
 * Persistent cache for LLM-enriched catalog-info.yaml suggestions.
 * Backed by SQLite (or PostgreSQL in production) via Backstage DatabaseService.
 *
 * No TTL — entries live until manually invalidated via `invalidate()`.
 * This avoids redundant LLM API calls on every backend restart while
 * allowing users to force fresh analysis when a repository changes.
 */

import type { Knex } from 'knex';
import type { LlmEnrichment } from './LLMAnalyzer';

/** A persisted cache entry for one repository. */
export type CachedSuggestion = {
  /** `owner/repo` key. */
  repoKey: string;
  /** YAML string for the catalog-info.yaml suggestion. */
  yaml: string;
  /** JSON-serialized AnalyzerSignals. */
  signalsJson: string;
  /** LLM-generated enrichment, or undefined if not yet enriched. */
  enrichment?: LlmEnrichment;
  /** Timestamp when the entry was first cached (Unix ms). */
  cachedAt: number;
  /** Timestamp of last refresh (Unix ms), or undefined if never refreshed. */
  refreshedAt?: number;
};

/** Row shape returned from the `suggestions` table. */
type DbRow = {
  owner: string;
  repo: string;
  yaml: string;
  signals_json: string;
  enrichment: string | null;
  cached_at: number;
  refreshed_at: number | null;
};

const rowToSuggestion = (row: DbRow): CachedSuggestion => ({
  repoKey: `${row.owner}/${row.repo}`,
  yaml: row.yaml,
  signalsJson: row.signals_json,
  enrichment: row.enrichment
    ? (JSON.parse(row.enrichment) as LlmEnrichment)
    : undefined,
  cachedAt: row.cached_at,
  refreshedAt: row.refreshed_at ?? undefined,
});

const parseRepoKey = (repoKey: string): { owner: string; repo: string } => {
  const slashIdx = repoKey.indexOf('/');
  return {
    owner: repoKey.slice(0, slashIdx),
    repo: repoKey.slice(slashIdx + 1),
  };
};

/**
 * Persistent cache for LLM-enriched catalog-info.yaml suggestions.
 * Backed by SQLite via Backstage DatabaseService (Knex). No TTL.
 */
export class SuggestionCache {
  constructor(private readonly knex: Knex) {}

  /**
   * Retrieve a cached suggestion. Returns `undefined` on cache miss.
   *
   * @param repoKey - Repository key in `owner/repo` format.
   */
  async get(repoKey: string): Promise<CachedSuggestion | undefined> {
    const { owner, repo } = parseRepoKey(repoKey);
    const row = await this.knex<DbRow>('suggestions')
      .where({ owner, repo })
      .first();
    return row ? rowToSuggestion(row) : undefined;
  }

  /**
   * Store a suggestion, overwriting any existing entry for the same repo.
   *
   * Uses `INSERT OR REPLACE` semantics via knex `onConflict().merge()`.
   *
   * @param repoKey - Repository key in `owner/repo` format.
   * @param suggestion - The suggestion to store.
   */
  async set(repoKey: string, suggestion: CachedSuggestion): Promise<void> {
    const { owner, repo } = parseRepoKey(repoKey);
    await this.knex('suggestions')
      .insert({
        owner,
        repo,
        yaml: suggestion.yaml,
        signals_json: suggestion.signalsJson,
        enrichment: suggestion.enrichment
          ? JSON.stringify(suggestion.enrichment)
          : null,
        cached_at: suggestion.cachedAt,
        refreshed_at: suggestion.refreshedAt ?? null,
      })
      .onConflict(['owner', 'repo'])
      .merge();
  }

  /**
   * Delete a cached entry, forcing re-analysis on the next request.
   *
   * @param repoKey - Repository key in `owner/repo` format.
   */
  async invalidate(repoKey: string): Promise<void> {
    const { owner, repo } = parseRepoKey(repoKey);
    await this.knex('suggestions').where({ owner, repo }).delete();
  }
}
