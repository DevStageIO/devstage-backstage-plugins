/**
 * Express router for the catalog-coverage-backend plugin.
 *
 * Repo aggregation logic lives in repoBuilder.ts (createRepoBuilder factory).
 * Onboarding (PR creation) lives in onboardHandler.ts.
 * Cache logic lives in suggestionService.ts; types/helpers in routerHelpers.ts.
 * The rate-limited /suggestions routes live in suggestionRoutes.ts.
 */

import {
  AuthService,
  LoggerService,
  UrlReaderService,
} from '@backstage/backend-plugin-api';
import { CatalogService } from '@backstage/plugin-catalog-node';
import express from 'express';
import Router from 'express-promise-router';
import { HeuristicAnalyzer } from '../services/HeuristicAnalyzer';
import { SchemaValidator } from '../services/SchemaValidator';
import { FetchDefaultBranch, UrlProbe } from './UrlProbe';
import { AccountTypeResolver } from '../services/accountTypeResolver';
import { RepoMetaCache } from '../services/repoMetaCache';
import { createRepoBuilder } from './repoBuilder';
import { createOnboardHandler } from './onboardHandler';
import { createCommitDirectHandler } from './commitDirectHandler';
import { createUpdateMetadataHandler } from './updateMetadataHandler';
import { createOwnerGuard } from './authz';
import { SuggestionCache } from '../services/SuggestionCache';
import { LLMAnalyzer } from '../services/LLMAnalyzer';
import { applyFilters } from './routerHelpers';
import { createSuggestionService } from './suggestionService';
import { registerSuggestionRoutes } from './suggestionRoutes';

export type RouterOptions = {
  logger: LoggerService;
  auth: AuthService;
  catalog: CatalogService;
  urlReader: UrlReaderService;
  /** GitHub token resolved from config (catalogCoverage.token) or env fallback. */
  githubToken?: string;
  /** GitHub owners that onboarding writes may target (fail-closed if empty). */
  allowedOwners?: Array<string>;
  fetchDefaultBranch?: FetchDefaultBranch;
  /** Persistent cache for LLM-enriched suggestions (Phase 3). */
  suggestionCache?: SuggestionCache;
  /** LLM analyzer for enriching catalog-info.yaml suggestions (Phase 3). */
  llmAnalyzer?: LLMAnalyzer;
  /** Default PR title override from app-config catalogCoverage.pr.title. */
  defaultPrTitle?: string;
  /** Default PR body override from app-config catalogCoverage.pr.body. */
  defaultPrBody?: string;
  /** Default owner to pre-fill in onboarding suggestions (from app-config catalogCoverage.defaultOwner). */
  defaultOwner?: { kind: string; ref: string };
  /** Cap on simultaneous outbound GitHub requests during a coverage sweep. */
  maxConcurrency?: number;
};

export const createRouter = async (
  options: RouterOptions,
): Promise<express.Router> => {
  const {
    logger,
    auth,
    catalog,
    urlReader,
    githubToken,
    allowedOwners = [],
    fetchDefaultBranch,
    llmAnalyzer,
    defaultPrTitle,
    defaultPrBody,
    maxConcurrency,
  } = options;
  const probe = new UrlProbe({ urlReader, logger, fetchDefaultBranch });
  const analyzer = new HeuristicAnalyzer(githubToken);
  const validator = new SchemaValidator();
  const accountTypeResolver = new AccountTypeResolver(githubToken);
  const repoMetaCache = new RepoMetaCache();
  const ownerGuard = createOwnerGuard(allowedOwners);

  const { buildAllRepos, buildRepo } = createRepoBuilder({
    auth,
    catalog,
    logger,
    probe,
    accountTypeResolver,
    repoMetaCache,
    githubToken,
    maxConcurrency,
  });

  const { suggestionCache, getCachedEntry, computeSuggestion } =
    createSuggestionService({
      logger,
      analyzer,
      validator,
      llmAnalyzer,
      githubToken,
    });

  const router = Router();
  // Cap request bodies: onboarding commits a single catalog-info.yaml, never megabytes.
  router.use(express.json({ limit: '256kb' }));

  router.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  router.get('/repos', async (req, res) => {
    const repos = await buildAllRepos();
    const filtered = applyFilters(repos, req.query as Record<string, unknown>);
    const summary = {
      total: filtered.length,
      present: filtered.filter(r => r.status === 'present').length,
      missing: filtered.filter(r => r.status === 'missing').length,
      invalid: filtered.filter(r => r.status === 'invalid').length,
    };
    res.json({ repos: filtered, summary });
  });

  router.get('/repos/:host/:org/:repo/*', async (req, res) => {
    const { host, org, repo: repoName } = req.params;
    const path = (req.params as { 0?: string })[0] ?? '';
    const match = await buildRepo({ host, org, name: repoName, path });
    if (!match) {
      res.status(404).json({ error: 'Repo not found in catalog projection' });
      return;
    }
    res.json(match);
  });

  registerSuggestionRoutes(router, {
    suggestionCache,
    getCachedEntry,
    computeSuggestion,
    githubToken,
  });

  router.post(
    '/repos/:owner/:repo/onboard',
    ownerGuard,
    createOnboardHandler({
      prTitle: defaultPrTitle,
      prBody: defaultPrBody,
      token: githubToken,
      validator,
    }),
  );
  router.post(
    '/repos/:owner/:repo/commit-direct',
    ownerGuard,
    createCommitDirectHandler({ token: githubToken, validator }),
  );
  router.patch(
    '/repos/:owner/:repo/metadata',
    ownerGuard,
    createUpdateMetadataHandler({ token: githubToken }),
  );

  return router;
};
