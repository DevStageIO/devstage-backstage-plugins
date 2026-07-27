import { Entity } from '@backstage/catalog-model';
import { NotFoundError } from '@backstage/errors';
import express from 'express';
import request from 'supertest';
import { createRouter } from './router';

const presentTarget =
  'https://github.com/zentala/repo/blob/main/catalog-info.yaml';
const missingTarget =
  'https://github.com/zentala/empty/blob/main/catalog-info.yaml';
const branchMismatchTarget =
  'https://github.com/zentala/old/blob/main/catalog-info.yaml';

const fixtures = {
  locations: [
    {
      apiVersion: 'backstage.io/v1alpha1',
      kind: 'Location',
      metadata: { name: 'zentala-repo', namespace: 'default' },
      spec: { type: 'url', target: presentTarget },
    },
    {
      apiVersion: 'backstage.io/v1alpha1',
      kind: 'Location',
      metadata: { name: 'zentala-empty', namespace: 'default' },
      spec: { type: 'url', target: missingTarget },
    },
    {
      apiVersion: 'backstage.io/v1alpha1',
      kind: 'Location',
      metadata: { name: 'zentala-old', namespace: 'default' },
      spec: { type: 'url', target: branchMismatchTarget },
    },
  ] as Array<Entity>,
  children: [
    {
      apiVersion: 'backstage.io/v1alpha1',
      kind: 'Component',
      metadata: {
        name: 'repo-svc',
        namespace: 'default',
        annotations: {
          'backstage.io/managed-by-origin-location': `url:${presentTarget}`,
        },
      },
      spec: { type: 'service' },
    },
  ] as Array<Entity>,
};

const noopLogger = () => {
  const logger: any = {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
  logger.child = () => logger;
  return logger;
};

const buildAuth = (): any => ({
  getOwnServiceCredentials: jest
    .fn()
    .mockResolvedValue({ principal: { type: 'service' } }),
});

const buildCatalog = (): any => ({
  getEntities: jest.fn(async (req: any) => {
    const filter = req?.filter as { kind?: string } | undefined;
    if (filter?.kind === 'Location') {
      return { items: fixtures.locations };
    }
    return { items: [...fixtures.locations, ...fixtures.children] };
  }),
});

const buildUrlReader = (): any => ({
  readUrl: jest.fn(async (url: string) => {
    if (url === branchMismatchTarget.replace('/blob/main/', '/blob/master/')) {
      return { buffer: async () => Buffer.from('') };
    }
    throw new NotFoundError(`404 ${url}`);
  }),
});

const buildApp = async () => {
  const router = await createRouter({
    logger: noopLogger(),
    auth: buildAuth(),
    catalog: buildCatalog(),
    urlReader: buildUrlReader(),
    fetchDefaultBranch: async (_host, _org, repo) => {
      if (repo === 'old') return 'master';
      return undefined;
    },
  });
  const app = express();
  app.use(router);
  return app;
};

describe('createRouter', () => {
  it('responds to /health', async () => {
    const app = await buildApp();
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it('returns repos with correct status mix', async () => {
    const app = await buildApp();
    const res = await request(app).get('/repos');
    expect(res.status).toBe(200);
    expect(res.body.repos).toHaveLength(3);
    const byStatus = Object.fromEntries(
      res.body.repos.map((r: any) => [r.name, r.status]),
    );
    expect(byStatus.repo).toBe('present');
    expect(byStatus.empty).toBe('missing');
    expect(byStatus.old).toBe('missing');
    expect(res.body.summary).toEqual({
      total: 3,
      present: 1,
      missing: 2,
      invalid: 0,
    });
  });

  it('surfaces branchMismatch on the affected row', async () => {
    const app = await buildApp();
    const res = await request(app).get('/repos');
    const oldRow = res.body.repos.find((r: any) => r.name === 'old');
    expect(oldRow.branchMismatch).toEqual({
      expectedBranch: 'main',
      actualDefaultBranch: 'master',
    });
  });

  it('filters by org', async () => {
    const app = await buildApp();
    const res = await request(app).get('/repos').query({ org: 'zentala' });
    expect(res.body.repos).toHaveLength(3);
    const empty = await request(app).get('/repos').query({ org: 'other-org' });
    expect(empty.body.repos).toHaveLength(0);
  });

  it('filters by status', async () => {
    const app = await buildApp();
    const res = await request(app).get('/repos').query({ status: 'present' });
    expect(res.body.repos).toHaveLength(1);
    expect(res.body.repos[0].name).toBe('repo');
  });

  it('filters by name substring (q)', async () => {
    const app = await buildApp();
    const res = await request(app).get('/repos').query({ q: 'emp' });
    expect(res.body.repos).toHaveLength(1);
    expect(res.body.repos[0].name).toBe('empty');
  });

  it('returns single repo via path params', async () => {
    const app = await buildApp();
    const res = await request(app).get(
      '/repos/github.com/zentala/repo/catalog-info.yaml',
    );
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('repo');
    expect(res.body.completeness?.children).toBeDefined();
  });

  it('returns 404 for unknown repo path', async () => {
    const app = await buildApp();
    const res = await request(app).get(
      '/repos/github.com/unknown/repo/catalog-info.yaml',
    );
    expect(res.status).toBe(404);
  });
});

// ─── /repos enrichment with GitHub metadata ───────────────────────────────────

describe('/repos enrichment', () => {
  let fetchSpy: jest.SpyInstance;

  beforeEach(() => {
    fetchSpy = jest
      .spyOn(global, 'fetch')
      .mockImplementation(async (input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input.toString();
        if (url.includes('/users/')) {
          return new Response(JSON.stringify({ type: 'User' }), {
            status: 200,
          });
        }
        // GitHub repo meta endpoint
        return new Response(
          JSON.stringify({
            stargazers_count: 12,
            archived: false,
            default_branch: 'main',
            description: 'My cool repo',
            pushed_at: '2024-03-15T08:00:00Z',
          }),
          { status: 200 },
        );
      });
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it('includes description, stars, pushedAt in /repos response for GitHub repos', async () => {
    const app = await buildApp();
    const res = await request(app).get('/repos');
    expect(res.status).toBe(200);
    const presentRepo = res.body.repos.find((r: any) => r.name === 'repo');
    expect(presentRepo).toBeDefined();
    expect(presentRepo.description).toBe('My cool repo');
    expect(presentRepo.stars).toBe(12);
    expect(presentRepo.pushedAt).toBe('2024-03-15T08:00:00Z');
  });
});

// ─── Suggestions endpoint tests ───────────────────────────────────────────────

const MOCK_REPO_META = {
  stargazers_count: 7,
  archived: false,
  default_branch: 'main',
  description: 'A test repo',
  pushed_at: '2024-06-01T12:00:00Z',
};

/** Stub fetch for suggestions tests — all file fetches return 404, meta returns OK. */
const mockFetchForSuggestions = (): jest.SpyInstance =>
  jest
    .spyOn(global, 'fetch')
    .mockImplementation(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (!url.includes('/contents/')) {
        return new Response(JSON.stringify(MOCK_REPO_META), { status: 200 });
      }
      return new Response(null, { status: 404 });
    });

describe('/suggestions endpoints', () => {
  let fetchSpy: jest.SpyInstance;

  beforeEach(() => {
    fetchSpy = mockFetchForSuggestions();
  });

  afterEach(() => {
    fetchSpy.mockRestore();
    jest.restoreAllMocks();
  });

  it('GET /suggestions/:owner/:repo returns 200 with yaml string', async () => {
    const app = await buildApp();
    const res = await request(app).get('/suggestions/zentala/backstage');
    expect(res.status).toBe(200);
    expect(typeof res.body.yaml).toBe('string');
    expect(res.body.yaml).toContain('apiVersion: backstage.io/v1alpha1');
    expect(res.body.yaml).toContain('kind: Component');
    expect(res.body.signals).toBeDefined();
    expect(Array.isArray(res.body.validatorErrors)).toBe(true);
  });

  it('GET /suggestions?refs=... returns result for each ref', async () => {
    const app = await buildApp();
    const res = await request(app)
      .get('/suggestions')
      .query({ refs: 'zentala/repo-a,zentala/repo-b' });
    expect(res.status).toBe(200);
    expect(res.body['zentala/repo-a']).toBeDefined();
    expect(res.body['zentala/repo-b']).toBeDefined();
    expect(typeof res.body['zentala/repo-a'].yaml).toBe('string');
  });

  it('GET /suggestions without refs returns 400', async () => {
    const app = await buildApp();
    const res = await request(app).get('/suggestions');
    expect(res.status).toBe(400);
  });

  it('POST /suggestions/:owner/:repo/refresh returns refreshed result', async () => {
    const app = await buildApp();
    const res = await request(app).post(
      '/suggestions/zentala/backstage/refresh',
    );
    expect(res.status).toBe(200);
    expect(typeof res.body.yaml).toBe('string');
  });

  it('POST /refresh rate-limits on second call for same repo (per-repo cooldown)', async () => {
    const app = await buildApp();
    // First call succeeds
    const first = await request(app).post(
      '/suggestions/zentala/rate-test/refresh',
    );
    expect(first.status).toBe(200);
    // Second call within 30s cooldown for same repo should be rate-limited
    const second = await request(app).post(
      '/suggestions/zentala/rate-test/refresh',
    );
    expect(second.status).toBe(429);
    expect(second.body.error).toContain('Too many requests');
    expect(second.headers['retry-after']).toBeDefined();
    expect(second.body.retryAfterSec).toBeGreaterThan(0);
  });
});

// ─── LLM enrichment tests ─────────────────────────────────────────────────────

describe('/suggestions LLM enrichment', () => {
  let fetchSpy: jest.SpyInstance;

  beforeEach(() => {
    fetchSpy = jest
      .spyOn(global, 'fetch')
      .mockImplementation(async (input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input.toString();
        if (url.includes('/readme')) {
          return new Response('# My Repo\nA great service.', { status: 200 });
        }
        if (!url.includes('/contents/')) {
          return new Response(
            JSON.stringify({
              stargazers_count: 5,
              archived: false,
              default_branch: 'main',
              description: 'A test service',
              pushed_at: '2024-01-01T00:00:00Z',
              topics: ['api'],
            }),
            { status: 200 },
          );
        }
        return new Response(null, { status: 404 });
      });
  });

  afterEach(() => {
    fetchSpy.mockRestore();
    jest.restoreAllMocks();
  });

  it('includes enrichment in response when LLMAnalyzer succeeds', async () => {
    const mockEnrichment = {
      description: 'An API service for managing widgets',
      type: 'service' as const,
      lifecycle: 'development' as const,
    };

    const mockLlmAnalyzer = {
      enrich: jest.fn().mockResolvedValue(mockEnrichment),
    } as any;

    const router = await createRouter({
      logger: noopLogger(),
      auth: buildAuth(),
      catalog: buildCatalog(),
      urlReader: buildUrlReader(),
      llmAnalyzer: mockLlmAnalyzer,
    });
    const app = express();
    app.use(router);

    const res = await request(app).get('/suggestions/zentala/widget-api');
    expect(res.status).toBe(200);
    expect(res.body.enrichment).toEqual(mockEnrichment);
    expect(res.body.yaml).toContain('An API service for managing widgets');
    expect(res.body.yaml).toContain('type: service');
    expect(res.body.yaml).toContain('lifecycle: development');
    expect(res.body.llmError).toBeUndefined();
    expect(mockLlmAnalyzer.enrich).toHaveBeenCalledWith(
      'zentala',
      'widget-api',
      expect.objectContaining({ archived: false }),
    );
  });

  it('falls back to heuristic yaml and sets llmError when LLMAnalyzer throws', async () => {
    const mockLlmAnalyzer = {
      enrich: jest.fn().mockRejectedValue(new Error('OpenAI quota exceeded')),
    } as any;

    const router = await createRouter({
      logger: noopLogger(),
      auth: buildAuth(),
      catalog: buildCatalog(),
      urlReader: buildUrlReader(),
      llmAnalyzer: mockLlmAnalyzer,
    });
    const app = express();
    app.use(router);

    const res = await request(app).get('/suggestions/zentala/broken-llm');
    expect(res.status).toBe(200);
    expect(res.body.llmError).toBe('OpenAI quota exceeded');
    expect(res.body.enrichment).toBeUndefined();
    expect(typeof res.body.yaml).toBe('string');
    expect(res.body.yaml).toContain('apiVersion: backstage.io/v1alpha1');
  });

  it('omits enrichment and llmError when no llmAnalyzer configured', async () => {
    const router = await createRouter({
      logger: noopLogger(),
      auth: buildAuth(),
      catalog: buildCatalog(),
      urlReader: buildUrlReader(),
    });
    const app = express();
    app.use(router);

    const res = await request(app).get('/suggestions/zentala/no-llm');
    expect(res.status).toBe(200);
    expect(res.body.enrichment).toBeUndefined();
    expect(res.body.llmError).toBeUndefined();
    expect(typeof res.body.yaml).toBe('string');
  });
});
