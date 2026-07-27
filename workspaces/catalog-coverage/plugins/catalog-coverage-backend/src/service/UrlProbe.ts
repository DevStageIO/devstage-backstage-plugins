import { LoggerService, UrlReaderService } from '@backstage/backend-plugin-api';
import { NotFoundError } from '@backstage/errors';
import { ProbeResult } from '../types';
import { parseGithubBlobUrl } from './LocationProjector';

const DEFAULT_TTL_MS = 30 * 60 * 1000;

export type FetchDefaultBranch = (
  host: string,
  org: string,
  repo: string,
) => Promise<string | undefined>;

export type UrlProbeOptions = {
  urlReader: UrlReaderService;
  logger: LoggerService;
  fetchDefaultBranch?: FetchDefaultBranch;
  ttlMs?: number;
  now?: () => number;
};

const isNotFound = (err: unknown): boolean => {
  if (err instanceof NotFoundError) return true;
  if (err && typeof err === 'object') {
    const name = (err as { name?: string }).name;
    if (name === 'NotFoundError') return true;
    const message = (err as { message?: string }).message ?? '';
    if (/404|not\s*found/i.test(message)) return true;
  }
  return false;
};

const replaceBranch = (
  target: string,
  fromBranch: string,
  toBranch: string,
): string => target.replace(`/blob/${fromBranch}/`, `/blob/${toBranch}/`);

/**
 * Stage-2 probe for Locations whose stage-1 catalog join produced 0 children.
 *
 * Distinguishes:
 * - `missing`: 404 from `urlReader.readUrl(target)`.
 * - `invalid`: 200 but the catalog still produced no entities (bad yaml,
 *   yaml-only-Locations, etc.).
 *
 * For 404s on a `https://github.com/.../blob/<branch>/...` URL, optionally
 * retries the read against the repo's GitHub `default_branch`. When the
 * file exists on the default branch but the registered Location pointed at
 * the wrong branch, the result still reports `missing` (the Location IS
 * stale) but attaches a `branchMismatch` hint so the UI can surface the
 * cause.
 */
export class UrlProbe {
  private readonly cache = new Map<string, ProbeResult>();
  private readonly urlReader: UrlReaderService;
  private readonly logger: LoggerService;
  private readonly fetchDefaultBranch?: FetchDefaultBranch;
  private readonly ttlMs: number;
  private readonly now: () => number;

  constructor(options: UrlProbeOptions) {
    this.urlReader = options.urlReader;
    this.logger = options.logger;
    this.fetchDefaultBranch = options.fetchDefaultBranch;
    this.ttlMs = options.ttlMs ?? DEFAULT_TTL_MS;
    this.now = options.now ?? (() => Date.now());
  }

  async probe(target: string): Promise<ProbeResult> {
    const cached = this.cache.get(target);
    if (cached && this.now() - cached.cachedAt < this.ttlMs) {
      return cached;
    }
    const result = await this.runProbe(target);
    this.cache.set(target, result);
    return result;
  }

  private async runProbe(target: string): Promise<ProbeResult> {
    try {
      const readResult = await this.urlReader.readUrl(target);
      let rawYaml: string | undefined;
      try {
        const buf = await readResult.buffer();
        rawYaml = buf.toString('utf-8');
      } catch {
        // best-effort — invalid status is already set regardless
      }
      return { status: 'invalid', cachedAt: this.now(), rawYaml };
    } catch (err) {
      if (!isNotFound(err)) {
        this.logger.warn(
          `UrlProbe failed for ${target}: ${(err as Error).message}`,
        );
        return { status: 'invalid', cachedAt: this.now() };
      }

      const parsed = parseGithubBlobUrl(target);
      if (!parsed || !this.fetchDefaultBranch) {
        return { status: 'missing', cachedAt: this.now() };
      }

      let defaultBranch: string | undefined;
      try {
        defaultBranch = await this.fetchDefaultBranch(
          parsed.host,
          parsed.org,
          parsed.name,
        );
      } catch (probeErr) {
        this.logger.debug(
          `Failed to fetch default branch for ${parsed.org}/${parsed.name}: ${
            (probeErr as Error).message
          }`,
        );
        return { status: 'missing', cachedAt: this.now() };
      }

      if (!defaultBranch || defaultBranch === parsed.branch) {
        return { status: 'missing', cachedAt: this.now() };
      }

      const retryUrl = replaceBranch(target, parsed.branch, defaultBranch);
      try {
        await this.urlReader.readUrl(retryUrl);
        return {
          status: 'missing',
          branchMismatch: {
            expectedBranch: parsed.branch,
            actualDefaultBranch: defaultBranch,
          },
          cachedAt: this.now(),
        };
      } catch {
        return { status: 'missing', cachedAt: this.now() };
      }
    }
  }
}
