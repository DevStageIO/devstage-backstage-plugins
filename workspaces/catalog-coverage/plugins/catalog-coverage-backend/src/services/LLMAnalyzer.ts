/**
 * LLMAnalyzer: enriches a GitHub repository's catalog-info.yaml suggestion
 * by calling an OpenAI-compatible LLM with README, description, and topics.
 *
 * The LLM produces a description, component type, and lifecycle classification.
 * Uses `@ai-sdk/openai` + `ai` (generateObject) for structured output.
 */

import { generateObject } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { z } from 'zod';
import { fetchReadmeExcerpt, RepoMeta } from './HeuristicFetchers';

/** Default model used for LLM enrichment. */
export const DEFAULT_LLM_MODEL = 'gpt-4o-mini';

/** LLM timeout in milliseconds. */
const LLM_TIMEOUT_MS = 10_000;

/**
 * Structured output produced by the LLM for a single repository.
 */
export type LlmEnrichment = {
  /** One-sentence description of what the project does. Max 120 chars. */
  description: string;
  /** Backstage component type. */
  type: 'service' | 'library' | 'website' | 'tool' | 'documentation';
  /** Project maturity stage. */
  lifecycle: 'experimental' | 'development' | 'production';
  /** Technology and domain tags. 2–8 items, lowercase kebab-case. */
  tags: Array<string>;
};

/**
 * Zod schema for validating the LLM response.
 * Used with `generateObject` to enforce structured output.
 */
export const LlmEnrichmentSchema = z.object({
  description: z.string().max(120),
  type: z.enum(['service', 'library', 'website', 'tool', 'documentation']),
  lifecycle: z.enum(['experimental', 'development', 'production']),
  tags: z
    .array(z.string().regex(/^[a-z0-9][a-z0-9-]*$/))
    .min(2)
    .max(8),
});

/** Build the classification prompt from repo signals. */
const buildPrompt = (
  owner: string,
  repo: string,
  repoMeta: RepoMeta,
  readmeExcerpt: string | null,
): string => {
  const description = repoMeta.description ?? 'not provided';
  const topics =
    repoMeta.topics.length > 0 ? repoMeta.topics.join(', ') : 'none';
  const readme = readmeExcerpt ?? 'No README found.';

  return [
    'You are classifying a GitHub repository for a software catalog.',
    '',
    `Repository name: ${owner}/${repo}`,
    `GitHub description: ${description}`,
    `GitHub topics: ${topics}`,
    '',
    'README (first 2000 characters):',
    '---',
    readme,
    '---',
    '',
    'Return a JSON object with exactly these fields:',
    '- description: one sentence (max 120 chars) explaining what this project does',
    '- type: one of service | library | website | tool | documentation',
    '- lifecycle: one of experimental | development | production',
    '- tags: array of 2–8 lowercase kebab-case strings (e.g. ["typescript", "react", "backstage-plugin"])',
    '',
    'Rules:',
    '- description: derive from README, not from the name alone',
    '- type "service": runs as a long-lived process (API, daemon, worker)',
    '- type "library": imported by other code, not deployed standalone',
    '- type "website": serves a web UI to end users',
    '- type "tool": CLI or dev tool run interactively',
    '- type "documentation": primarily docs, not runnable code',
    '- lifecycle "production": explicitly described as stable/production-ready in README',
    '- lifecycle "development": actively under development, pre-release',
    '- lifecycle "experimental": proof-of-concept, prototype, or unclear maturity',
    '- tags: cover primary language, frameworks, domain (e.g. "typescript", "strapi", "cms", "rest-api")',
    '- tags: lowercase, only alphanumeric and hyphens, no spaces',
    '- tags: 2 minimum, 8 maximum — prefer 3–5 specific tags over many generic ones',
  ].join('\n');
};

/**
 * LLMAnalyzer fetches a repository's README and calls an OpenAI-compatible
 * LLM to generate a description, type, and lifecycle classification for
 * the catalog-info.yaml suggestion.
 *
 * `OPENAI_API_KEY` is required. `OPENAI_BASE_URL` is optional — when set,
 * all calls are routed to that OpenAI-compatible endpoint — a self-hosted
 * LiteLLM or vLLM gateway, for instance. When unset, calls go to
 * api.openai.com.
 */
export class LLMAnalyzer {
  private readonly githubToken: string;
  private readonly model: string;

  constructor(githubToken: string, model: string = DEFAULT_LLM_MODEL) {
    this.githubToken = githubToken;
    this.model = model;
  }

  /**
   * Enrich a repository with LLM-generated description, type, and lifecycle.
   *
   * Fetches the README, builds a classification prompt, and calls the LLM
   * with a 10-second timeout. Returns structured output validated by
   * {@link LlmEnrichmentSchema}.
   */
  async enrich(
    owner: string,
    repo: string,
    repoMeta: RepoMeta,
  ): Promise<LlmEnrichment> {
    const readmeExcerpt = await fetchReadmeExcerpt(
      owner,
      repo,
      this.githubToken,
    );

    const prompt = buildPrompt(owner, repo, repoMeta, readmeExcerpt);

    const openai = createOpenAI({
      baseURL: process.env.OPENAI_BASE_URL ?? undefined,
      apiKey: process.env.OPENAI_API_KEY,
    });

    const { object } = await generateObject({
      model: openai(this.model),
      schema: LlmEnrichmentSchema,
      prompt,
      abortSignal: AbortSignal.timeout(LLM_TIMEOUT_MS),
    });

    return object;
  }
}
