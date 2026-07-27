/**
 * Registration of the `/suggestions` routes for the catalog-coverage router.
 *
 * These three routes are the only rate-limited, cost-bearing endpoints in the
 * plugin — they reach GitHub and, when an LLM analyzer is configured, a billed
 * completion API. Grouping them keeps their two rate limiters and the shared
 * 429 response next to the handlers they protect, instead of spread through the
 * router's wiring.
 */

import express from 'express';
import { SlidingWindowRateLimiter } from './rateLimiter';
import { fetchRepoMeta } from '../services/HeuristicFetchers';
import {
  CacheEntry,
  computeSuggestionsBatch,
  REFRESH_COOLDOWN_REPO_MS,
  REFRESH_MAX_PER_MIN,
  REFRESH_MAX_PER_HR,
  SUGGESTIONS_MAX_PER_MIN,
  SUGGESTIONS_MAX_PER_HR,
  SuggestionResult,
} from './routerHelpers';

export type SuggestionRoutesDeps = {
  /** Cache handle, used to evict a repo's entry on refresh. */
  suggestionCache: { delete: (key: string) => void };
  getCachedEntry: (key: string) => CacheEntry | undefined;
  computeSuggestion: (owner: string, repo: string) => Promise<SuggestionResult>;
  githubToken?: string;
};

/** Attaches the suggestion routes to the given router. */
export const registerSuggestionRoutes = (
  router: express.Router,
  deps: SuggestionRoutesDeps,
): void => {
  const { suggestionCache, getCachedEntry, computeSuggestion, githubToken } =
    deps;

  const refreshLimiter = new SlidingWindowRateLimiter(
    REFRESH_COOLDOWN_REPO_MS,
    REFRESH_MAX_PER_MIN,
    REFRESH_MAX_PER_HR,
  );
  // Global-only limiter (no per-repo cooldown) protecting the billed, cache-bypassable
  // GET /suggestions routes from unauthenticated GitHub/OpenAI cost abuse (E014 sec #3).
  const suggestionsLimiter = new SlidingWindowRateLimiter(
    0,
    SUGGESTIONS_MAX_PER_MIN,
    SUGGESTIONS_MAX_PER_HR,
  );

  const send429 = (res: express.Response, retryAfterSec: number): void => {
    res.set('Retry-After', String(retryAfterSec));
    res.status(429).json({ error: 'Too many requests', retryAfterSec });
  };

  /** Consumes one unit of the global budget, or answers 429 and returns false. */
  const allowSuggestionsRequest = (res: express.Response): boolean => {
    const now = Date.now();
    const decision = suggestionsLimiter.check('global', now);
    if (decision.limited) {
      send429(res, decision.retryAfterSec);
      return false;
    }
    suggestionsLimiter.record('global', now);
    return true;
  };

  router.get('/suggestions/:owner/:repo', async (req, res) => {
    if (!allowSuggestionsRequest(res)) return;
    const { owner, repo } = req.params;
    res.json(await computeSuggestion(owner, repo));
  });

  router.get('/suggestions', async (req, res) => {
    if (!allowSuggestionsRequest(res)) return;
    const refsParam = req.query.refs;
    if (typeof refsParam !== 'string' || !refsParam) {
      res.status(400).json({
        error:
          'refs query parameter is required (e.g. ?refs=owner/repo,owner2/repo2)',
      });
      return;
    }
    const refs = refsParam
      .split(',')
      .map(r => r.trim())
      .filter(Boolean);
    res.json(await computeSuggestionsBatch(refs, computeSuggestion));
  });

  router.post('/suggestions/:owner/:repo/refresh', async (req, res) => {
    const { owner, repo } = req.params;
    const repoKey = `${owner}/${repo}`;
    const now = Date.now();

    const decision = refreshLimiter.check(repoKey, now);
    if (decision.limited) {
      send429(res, decision.retryAfterSec);
      return;
    }

    // Don't spend the refresh budget when nothing changed: an unchanged
    // pushedAt means re-analysing would produce the same answer.
    const cachedEntry = getCachedEntry(repoKey);
    if (cachedEntry?.repoLastPush) {
      const currentMeta = await fetchRepoMeta(owner, repo, githubToken);
      if (
        currentMeta?.pushedAt &&
        currentMeta.pushedAt === cachedEntry.repoLastPush
      ) {
        res.json({
          ...cachedEntry.result,
          skipped: true,
          reason: 'repo unchanged since last analysis',
        });
        return;
      }
    }

    refreshLimiter.record(repoKey, now);
    suggestionCache.delete(repoKey);
    res.json(await computeSuggestion(owner, repo));
  });
};
