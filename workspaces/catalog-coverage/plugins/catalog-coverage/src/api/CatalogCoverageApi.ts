import {
  DiscoveryApi,
  FetchApi,
  createApiRef,
} from '@backstage/core-plugin-api';
import { ResponseError } from '@backstage/errors';
import type { Repo, ReposResponse } from '../data/types';
import type { CatalogCoverageConfig } from '../config';
import { DEFAULT_GITHUB_CATALOG_INFO_CONFIG } from '../config';

/**
 * Server-side filters for the coverage listing.
 *
 * @public
 */
export type ListReposOptions = {
  org?: string;
  status?: Repo['status'];
  q?: string;
};

/**
 * LLM-generated enrichment fields for a catalog-info.yaml suggestion.
 *
 * @public
 */
export type LlmEnrichment = {
  description: string;
  type: 'service' | 'library' | 'website' | 'tool' | 'documentation';
  lifecycle: 'experimental' | 'development' | 'production';
  /**
   * Technology and domain tags suggested by AI. 2–8 lowercase kebab-case strings.
   * Optional for backward compatibility with API responses predating d3ed9ed.
   * New backend always returns tags (Zod schema enforces min 2).
   */
  tags?: Array<string>;
};

/**
 * Response from the suggestion API — auto-generated catalog-info.yaml for a repo.
 *
 * @public
 */
export type SuggestionResponse = {
  owner: string;
  repo: string;
  yaml: string;
  signals: Record<string, unknown>;
  cachedAt?: string;
  /** Present when LLM enrichment ran successfully. */
  enrichment?: LlmEnrichment;
  /** Present when LLM was attempted but failed (e.g. quota, bad key). */
  llmError?: string;
};

/**
 * Frontend contract for the catalog-coverage backend: read the coverage
 * report, generate catalog-info.yaml suggestions, and onboard repositories.
 *
 * @public
 */
export interface CatalogCoverageApi {
  /** Returns resolved plugin configuration (from app-config.yaml). */
  getConfig(): CatalogCoverageConfig;
  /** Fetch the coverage report, optionally filtered. */
  listRepos(options?: ListReposOptions): Promise<ReposResponse>;
  /** Fetch a generated catalog-info.yaml suggestion for a single repo. */
  getSuggestion(owner: string, repo: string): Promise<SuggestionResponse>;
  /** Fetch suggestions for multiple repos in one call. */
  getSuggestionsBatch(refs: Array<string>): Promise<Array<SuggestionResponse>>;
  /** Create a catalog-info.yaml PR via the backend (uses server-side GITHUB_TOKEN). */
  onboardRepo(
    owner: string,
    repo: string,
    yaml: string,
    title?: string,
    body?: string,
  ): Promise<{ link: string; location: string }>;
  /** Invalidate cache and regenerate suggestion for a single repo. */
  refreshSuggestion(owner: string, repo: string): Promise<SuggestionResponse>;
  /** Update GitHub repository description and/or topics via the backend. */
  updateRepoMetadata(
    owner: string,
    repo: string,
    metadata: { description?: string; topics?: Array<string> },
  ): Promise<{ description: string | null; topics: Array<string> }>;
  /**
   * Commit catalog-info.yaml directly to the default branch (no PR).
   * Use only when branch protection is absent on the target repository.
   */
  commitDirectRepo(
    owner: string,
    repo: string,
    yaml: string,
    message?: string,
  ): Promise<{ link: string }>;
}

/**
 * API ref the page resolves to reach the backend.
 *
 * @public
 */
export const catalogCoverageApiRef = createApiRef<CatalogCoverageApi>({
  id: 'plugin.catalog-coverage.service',
});

/**
 * Default {@link CatalogCoverageApi} implementation, talking to the backend
 * plugin over the Backstage discovery + fetch APIs.
 *
 * @public
 */
export class CatalogCoverageClient implements CatalogCoverageApi {
  private readonly discoveryApi: DiscoveryApi;
  private readonly fetchApi: FetchApi;
  private readonly pluginConfig: CatalogCoverageConfig;

  constructor(deps: {
    discoveryApi: DiscoveryApi;
    fetchApi: FetchApi;
    config?: CatalogCoverageConfig;
  }) {
    this.discoveryApi = deps.discoveryApi;
    this.fetchApi = deps.fetchApi;
    this.pluginConfig = deps.config ?? DEFAULT_GITHUB_CATALOG_INFO_CONFIG;
  }

  /** {@inheritDoc CatalogCoverageApi.getConfig} */
  getConfig(): CatalogCoverageConfig {
    return this.pluginConfig;
  }

  /** {@inheritDoc CatalogCoverageApi.listRepos} */
  async listRepos(options: ListReposOptions = {}): Promise<ReposResponse> {
    const baseUrl = await this.discoveryApi.getBaseUrl('catalog-coverage');
    const search = new URLSearchParams();
    if (options.org) search.set('org', options.org);
    if (options.status) search.set('status', options.status);
    if (options.q) search.set('q', options.q);
    const qs = search.toString();
    const url = `${baseUrl}/repos${qs ? `?${qs}` : ''}`;
    const response = await this.fetchApi.fetch(url);
    if (!response.ok) {
      throw await ResponseError.fromResponse(response);
    }
    return (await response.json()) as ReposResponse;
  }

  /** {@inheritDoc CatalogCoverageApi.getSuggestion} */
  async getSuggestion(
    owner: string,
    repo: string,
  ): Promise<SuggestionResponse> {
    const baseUrl = await this.discoveryApi.getBaseUrl('catalog-coverage');
    const response = await this.fetchApi.fetch(
      `${baseUrl}/suggestions/${owner}/${repo}`,
    );
    if (!response.ok) {
      throw await ResponseError.fromResponse(response);
    }
    return (await response.json()) as SuggestionResponse;
  }

  /** {@inheritDoc CatalogCoverageApi.getSuggestionsBatch} */
  async getSuggestionsBatch(
    refs: Array<string>,
  ): Promise<Array<SuggestionResponse>> {
    const baseUrl = await this.discoveryApi.getBaseUrl('catalog-coverage');
    const response = await this.fetchApi.fetch(
      `${baseUrl}/suggestions?refs=${refs.join(',')}`,
    );
    if (!response.ok) {
      throw await ResponseError.fromResponse(response);
    }
    // Backend returns Record<"owner/repo", SuggestionResult> — transform to array.
    const dict = (await response.json()) as Record<
      string,
      Record<string, unknown>
    >;
    return Object.entries(dict)
      .filter(([, v]) => !('error' in v))
      .map(([ref, result]) => {
        const slash = ref.indexOf('/');
        return {
          owner: ref.slice(0, slash),
          repo: ref.slice(slash + 1),
          ...result,
        } as SuggestionResponse;
      });
  }

  /** {@inheritDoc CatalogCoverageApi.onboardRepo} */
  async onboardRepo(
    owner: string,
    repo: string,
    yaml: string,
    title?: string,
    body?: string,
  ): Promise<{ link: string; location: string }> {
    const baseUrl = await this.discoveryApi.getBaseUrl('catalog-coverage');
    const response = await this.fetchApi.fetch(
      `${baseUrl}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(
        repo,
      )}/onboard`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ yaml, title, body }),
      },
    );
    if (!response.ok) {
      throw await ResponseError.fromResponse(response);
    }
    return (await response.json()) as { link: string; location: string };
  }

  /** {@inheritDoc CatalogCoverageApi.refreshSuggestion} */
  async refreshSuggestion(
    owner: string,
    repo: string,
  ): Promise<SuggestionResponse> {
    const baseUrl = await this.discoveryApi.getBaseUrl('catalog-coverage');
    const response = await this.fetchApi.fetch(
      `${baseUrl}/suggestions/${encodeURIComponent(owner)}/${encodeURIComponent(
        repo,
      )}/refresh`,
      { method: 'POST' },
    );
    if (response.status === 429) {
      const payload = (await response.json().catch(() => ({}))) as Record<
        string,
        unknown
      >;
      const retryAfterSec =
        typeof payload.retryAfterSec === 'number'
          ? payload.retryAfterSec
          : undefined;
      throw Object.assign(
        new Error(
          retryAfterSec !== undefined
            ? `Try again in ${retryAfterSec} seconds`
            : 'Too many requests',
        ),
        { retryAfterSec, status: 429 },
      );
    }
    if (!response.ok) {
      throw await ResponseError.fromResponse(response);
    }
    return (await response.json()) as SuggestionResponse;
  }

  /** {@inheritDoc CatalogCoverageApi.updateRepoMetadata} */
  async updateRepoMetadata(
    owner: string,
    repo: string,
    metadata: { description?: string; topics?: Array<string> },
  ): Promise<{ description: string | null; topics: Array<string> }> {
    const baseUrl = await this.discoveryApi.getBaseUrl('catalog-coverage');
    const response = await this.fetchApi.fetch(
      `${baseUrl}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(
        repo,
      )}/metadata`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(metadata),
      },
    );
    if (!response.ok) {
      throw await ResponseError.fromResponse(response);
    }
    return (await response.json()) as {
      description: string | null;
      topics: Array<string>;
    };
  }

  /** {@inheritDoc CatalogCoverageApi.commitDirectRepo} */
  async commitDirectRepo(
    owner: string,
    repo: string,
    yaml: string,
    message?: string,
  ): Promise<{ link: string }> {
    const baseUrl = await this.discoveryApi.getBaseUrl('catalog-coverage');
    const response = await this.fetchApi.fetch(
      `${baseUrl}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(
        repo,
      )}/commit-direct`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ yaml, message }),
      },
    );
    if (!response.ok) {
      throw await ResponseError.fromResponse(response);
    }
    return (await response.json()) as { link: string };
  }
}
