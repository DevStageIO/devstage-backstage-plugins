/**
 * Suggestion cache and compute logic for the catalog-coverage router.
 *
 * Extracted from router.ts to keep it under the 250-line limit.
 * `createSuggestionService` is a factory that owns the in-memory cache Map
 * and returns helpers that close over it — callers receive the Map ref so they
 * can call `.delete()` directly (e.g. the refresh endpoint).
 */

import { LoggerService } from '@backstage/backend-plugin-api';
import { HeuristicAnalyzer } from '../services/HeuristicAnalyzer';
import { SchemaValidator } from '../services/SchemaValidator';
import { LLMAnalyzer } from '../services/LLMAnalyzer';
import { fetchRepoMeta } from '../services/HeuristicFetchers';
import {
  applyEnrichment,
  CacheEntry,
  CACHE_TTL_MS,
  SuggestionResult,
} from './routerHelpers';

export type SuggestionServiceDeps = {
  logger: LoggerService;
  analyzer: HeuristicAnalyzer;
  validator: SchemaValidator;
  llmAnalyzer: LLMAnalyzer | undefined;
  /** GitHub token resolved from config/env by the router. */
  githubToken?: string;
};

export type SuggestionService = {
  suggestionCache: Map<string, CacheEntry>;
  getCachedEntry: (key: string) => CacheEntry | undefined;
  getCachedSuggestion: (key: string) => SuggestionResult | undefined;
  setCachedSuggestion: (
    key: string,
    result: SuggestionResult,
    repoLastPush?: string,
  ) => void;
  computeSuggestion: (owner: string, repo: string) => Promise<SuggestionResult>;
};

export const createSuggestionService = (
  deps: SuggestionServiceDeps,
): SuggestionService => {
  const { logger, analyzer, validator, llmAnalyzer, githubToken } = deps;

  /** In-memory suggestion cache. Key: "owner/repo". TTL: CACHE_TTL_MS. */
  const suggestionCache = new Map<string, CacheEntry>();

  /** NOTE: repoLastPush is only populated when LLMAnalyzer is active (OPENAI_API_KEY set).
   *  Without LLM, the inactive-repo skip in the refresh endpoint never fires. */
  const getCachedEntry = (key: string): CacheEntry | undefined => {
    const entry = suggestionCache.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      suggestionCache.delete(key);
      return undefined;
    }
    return entry;
  };

  const getCachedSuggestion = (key: string): SuggestionResult | undefined =>
    getCachedEntry(key)?.result;

  const setCachedSuggestion = (
    key: string,
    result: SuggestionResult,
    repoLastPush?: string,
  ): void => {
    suggestionCache.set(key, {
      result,
      expiresAt: Date.now() + CACHE_TTL_MS,
      repoLastPush,
    });
  };

  const computeSuggestion = async (
    owner: string,
    repo: string,
  ): Promise<SuggestionResult> => {
    const key = `${owner}/${repo}`;
    const cached = getCachedSuggestion(key);
    if (cached) return cached;

    const { yaml: heuristicYaml, signals } = await analyzer.analyze(
      owner,
      repo,
    );

    let enrichedYaml = heuristicYaml;
    let enrichment = undefined as SuggestionResult['enrichment'];
    let llmError: string | undefined;
    let repoLastPush: string | undefined;

    if (llmAnalyzer) {
      try {
        const repoMeta = await fetchRepoMeta(owner, repo, githubToken);
        const meta = repoMeta ?? {
          stars: 0,
          archived: false,
          defaultBranch: 'main',
          topics: [],
          description: null,
          pushedAt: null,
        };
        repoLastPush = meta.pushedAt ?? undefined;
        enrichment = await llmAnalyzer.enrich(owner, repo, meta);
        enrichedYaml = applyEnrichment(heuristicYaml, enrichment);
      } catch (err) {
        logger.warn(`LLMAnalyzer failed for ${owner}/${repo}: ${err}`);
        llmError = err instanceof Error ? err.message : String(err);
      }
    }

    const { errors: validatorErrors } = validator.validate(enrichedYaml);
    const result: SuggestionResult = {
      yaml: enrichedYaml,
      signals,
      ...(enrichment !== undefined ? { enrichment } : {}),
      ...(llmError !== undefined ? { llmError } : {}),
      validatorErrors,
    };
    setCachedSuggestion(key, result, repoLastPush);
    return result;
  };

  return {
    suggestionCache,
    getCachedEntry,
    getCachedSuggestion,
    setCachedSuggestion,
    computeSuggestion,
  };
};
