/**
 * Internal types, constants, and pure helpers for the catalog-coverage router.
 */

import * as yaml from 'js-yaml';
import pLimit from 'p-limit';
import { Repo } from '../types';
import { AnalyzerSignals } from '../services/HeuristicAnalyzer';
import { ValidationError } from '../services/SchemaValidator';
import { LlmEnrichment } from '../services/LLMAnalyzer';

export const applyFilters = (
  repos: Array<Repo>,
  query: Record<string, unknown>,
): Array<Repo> => {
  let result = repos;
  const { org, status, q } = query;
  if (typeof org === 'string' && org.length > 0) {
    result = result.filter(r => r.org === org);
  }
  if (typeof status === 'string' && status.length > 0) {
    result = result.filter(r => r.status === status);
  }
  if (typeof q === 'string' && q.length > 0) {
    const needle = q.toLowerCase();
    result = result.filter(r => r.name.toLowerCase().includes(needle));
  }
  return result;
};

export type SuggestionResult = {
  yaml: string;
  signals: AnalyzerSignals;
  enrichment?: LlmEnrichment;
  llmError?: string;
  validatorErrors: Array<ValidationError>;
  /** Set to true by the refresh endpoint when the repo has not changed since the last analysis. */
  skipped?: boolean;
  /** Human-readable reason for skipping (only present when skipped is true). */
  reason?: string;
};

/** Apply LLM enrichment to a YAML string. Uses yaml.load/yaml.dump — NOT regex. */
export const applyEnrichment = (
  yamlStr: string,
  enrichment: LlmEnrichment,
): string => {
  const doc = yaml.load(yamlStr);
  if (!doc || typeof doc !== 'object') {
    throw new Error(
      `applyEnrichment: yaml.load returned ${
        doc === null ? 'null' : typeof doc
      }`,
    );
  }
  const d = doc as Record<string, any>;
  (d.metadata as any).description = enrichment.description;
  if (enrichment.tags?.length) (d.metadata as any).tags = enrichment.tags;
  (d.spec as any).type = enrichment.type;
  (d.spec as any).lifecycle = enrichment.lifecycle;
  return yaml.dump(d, { lineWidth: 120 });
};

const _parsedTtl = Number(process.env.CATALOG_COVERAGE_CACHE_TTL_DAYS ?? '30');
export const CACHE_TTL_DAYS =
  Number.isFinite(_parsedTtl) && _parsedTtl > 0 ? _parsedTtl : 30;
export const CACHE_TTL_MS = CACHE_TTL_DAYS * 24 * 60 * 60 * 1000;

/** Per-repo cooldown: 30 seconds between refreshes for the same repo. */
export const REFRESH_COOLDOWN_REPO_MS = 30_000;
/** Global sliding window: max 6 refreshes per minute. */
export const REFRESH_MAX_PER_MIN = 6;
/** Global sliding window: max 30 refreshes per hour. */
export const REFRESH_MAX_PER_HR = 30;

/**
 * GET /suggestions global caps — looser than refresh (normal browsing of a
 * large catalog hits these routes) but bounded to stop unauthenticated
 * cost-abuse loops that vary the repo name to bypass the cache.
 */
export const SUGGESTIONS_MAX_PER_MIN = 60;
export const SUGGESTIONS_MAX_PER_HR = 600;

/** Concurrency for the batch GET /suggestions route. */
const SUGGESTIONS_BATCH_CONCURRENCY = 3;

/**
 * Resolves a batch of `owner/repo` refs to suggestions, a few at a time.
 *
 * Each ref fails independently: a malformed ref or a thrown analyzer error
 * becomes an `{ error }` entry for that ref rather than failing the batch, so a
 * page showing thirty repos does not go blank because one of them 404s.
 */
export const computeSuggestionsBatch = async (
  refs: Array<string>,
  computeSuggestion: (owner: string, repo: string) => Promise<SuggestionResult>,
): Promise<Record<string, SuggestionResult | { error: string }>> => {
  const limit = pLimit(SUGGESTIONS_BATCH_CONCURRENCY);
  const entries = await Promise.all(
    refs.map(ref =>
      limit(async () => {
        const slash = ref.indexOf('/');
        if (slash < 1) return [ref, { error: 'invalid ref format' }] as const;
        try {
          return [
            ref,
            await computeSuggestion(ref.slice(0, slash), ref.slice(slash + 1)),
          ] as const;
        } catch (err) {
          return [ref, { error: (err as Error).message }] as const;
        }
      }),
    ),
  );
  return Object.fromEntries(entries);
};

export type CacheEntry = {
  result: SuggestionResult;
  expiresAt: number;
  repoLastPush?: string;
};
