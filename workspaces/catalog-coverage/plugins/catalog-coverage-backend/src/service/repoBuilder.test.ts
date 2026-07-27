/**
 * Tests for the bounded-concurrency repo builder.
 *
 * The concurrency assertions instrument the work the limiter wraps and record
 * the observed peak — they deliberately do not assert that `p-limit` was
 * called, since that would pass even if the limiter were bypassed.
 */

import { Entity } from '@backstage/catalog-model';
import { createRepoBuilder, DEFAULT_MAX_CONCURRENCY } from './repoBuilder';
import { ORIGIN_ANNOTATION } from './LocationProjector';
import { OpenPrLookup } from './openPrLookup';
import { Repo } from '../types';

/** Counter that records the peak number of simultaneously running sections. */
const createConcurrencyTracker = () => {
  let inFlight = 0;
  let peak = 0;
  return {
    get peak() {
      return peak;
    },
    /** Wraps a body so its overlap with other wrapped bodies is measured. */
    async track<T>(body: () => Promise<T>): Promise<T> {
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      try {
        return await body();
      } finally {
        inFlight -= 1;
      }
    },
  };
};

/** Yields to the event loop long enough for queued work to pile up. */
const yieldToEventLoop = () =>
  new Promise<void>(resolve => setImmediate(resolve));

const locationTargetOf = (index: number): string =>
  `https://github.com/acme-${index}/widget/blob/main/catalog-info.yaml`;

const makeLocation = (index: number): Entity => ({
  apiVersion: 'backstage.io/v1alpha1',
  kind: 'Location',
  metadata: { name: `loc-${index}` },
  spec: { target: locationTargetOf(index) },
});

const makeChild = (index: number): Entity => ({
  apiVersion: 'backstage.io/v1alpha1',
  kind: 'Component',
  metadata: {
    name: `widget-${index}`,
    description: 'a widget component',
    annotations: { [ORIGIN_ANNOTATION]: `url:${locationTargetOf(index)}` },
  },
  spec: { type: 'service', lifecycle: 'production', owner: 'zentala' },
});

const metaResponse = () =>
  ({
    ok: true,
    headers: { get: () => null },
    body: undefined,
    json: async () => ({
      description: 'a widget',
      topics: [],
      stargazers_count: 1,
      forks_count: 0,
      pushed_at: '2026-07-01T00:00:00Z',
      archived: false,
      visibility: 'public',
      default_branch: 'main',
    }),
  } as unknown as Response);

type HarnessOptions = {
  repoCount: number;
  maxConcurrency?: number;
  /** Orgs whose enrichment should throw, simulating a per-repo GitHub failure. */
  failingOrgs?: Array<string>;
  openPrLookup?: OpenPrLookup;
  /** Indexes whose Location has a child Component in the catalog. */
  childIndexes?: Array<number>;
};

type CatalogRequest = { filter?: Record<string, unknown> };

const createHarness = (options: HarnessOptions) => {
  const {
    repoCount,
    maxConcurrency,
    failingOrgs = [],
    openPrLookup,
    childIndexes = [],
  } = options;
  const tracker = createConcurrencyTracker();
  const locations = Array.from({ length: repoCount }, (_, i) =>
    makeLocation(i),
  );
  const allChildren = childIndexes.map(makeChild);
  const warnings: Array<string> = [];
  const catalogRequests: Array<CatalogRequest> = [];
  const probedUrls: Array<string> = [];

  const logger = {
    warn: (message: string) => warnings.push(message),
    info: () => {},
    error: () => {},
    debug: () => {},
    child: () => logger,
  };

  const probe = {
    probe: (url: string) =>
      tracker.track(async () => {
        probedUrls.push(url);
        await yieldToEventLoop();
        return {
          status: 'missing' as const,
          cachedAt: Date.now(),
          rawYaml: undefined,
          url,
        };
      }),
  };

  const accountTypeResolver = {
    resolve: (org: string) =>
      tracker.track(async () => {
        await yieldToEventLoop();
        if (failingOrgs.includes(org)) {
          throw new Error(`403 rate limited for ${org}`);
        }
        return 'Organization' as const;
      }),
  };

  const builder = createRepoBuilder({
    auth: {
      getOwnServiceCredentials: async () => ({}),
    } as never,
    catalog: {
      getEntities: async (request: CatalogRequest) => {
        catalogRequests.push(request);
        const filter = request?.filter ?? {};
        if (filter.kind === 'Location') return { items: locations };

        const originFilter = filter[`metadata.annotations.${ORIGIN_ANNOTATION}`];
        if (originFilter === undefined) return { items: allChildren };

        // Mirrors the catalog's OR semantics for an array filter value.
        const targets = Array.isArray(originFilter)
          ? originFilter
          : [originFilter];
        return {
          items: allChildren.filter(child =>
            targets.includes(child.metadata.annotations![ORIGIN_ANNOTATION]),
          ),
        };
      },
    } as never,
    logger: logger as never,
    probe: probe as never,
    accountTypeResolver: accountTypeResolver as never,
    repoMetaCache: { get: () => undefined, set: () => {} } as never,
    githubToken: 'tkn',
    maxConcurrency,
    openPrLookup,
  });

  return { builder, tracker, warnings, catalogRequests, probedUrls };
};

describe('createRepoBuilder', () => {
  beforeEach(() => {
    global.fetch = jest
      .fn()
      .mockImplementation(async () =>
        metaResponse(),
      ) as unknown as typeof fetch;
  });

  it('never exceeds the configured concurrency cap', async () => {
    const { builder, tracker } = createHarness({
      repoCount: 50,
      maxConcurrency: 4,
    });

    const repos = await builder.buildAllRepos();

    expect(repos).toHaveLength(50);
    expect(tracker.peak).toBe(4);
  });

  it('applies a cap of 2 when configured to 2', async () => {
    const { builder, tracker } = createHarness({
      repoCount: 20,
      maxConcurrency: 2,
    });

    await builder.buildAllRepos();

    expect(tracker.peak).toBe(2);
  });

  it('falls back to the default cap when none is configured', async () => {
    const { builder, tracker } = createHarness({ repoCount: 40 });

    await builder.buildAllRepos();

    expect(DEFAULT_MAX_CONCURRENCY).toBe(8);
    expect(tracker.peak).toBe(DEFAULT_MAX_CONCURRENCY);
  });

  it('shares one budget across the probe and enrich phases', async () => {
    const { builder, tracker } = createHarness({
      repoCount: 30,
      maxConcurrency: 3,
    });

    await builder.buildAllRepos();

    // Both phases are instrumented by the same tracker; a peak above the cap
    // would mean each phase got its own budget.
    expect(tracker.peak).toBeLessThanOrEqual(3);
  });

  it('degrades a single failing repo instead of emptying the table', async () => {
    const { builder, warnings } = createHarness({
      repoCount: 50,
      maxConcurrency: 4,
      failingOrgs: ['acme-3'],
    });

    const repos = await builder.buildAllRepos();

    expect(repos).toHaveLength(50);
    const failed = repos.find(r => r.org === 'acme-3')!;
    expect(failed.accountType).toBeUndefined();
    expect(failed.taxonomyStatus).toBeUndefined();
    expect(failed.locationRef).toBe('location:default/loc-3');
    expect(repos.filter(r => r.accountType === 'Organization')).toHaveLength(
      49,
    );
    expect(warnings).toEqual([
      'Enrich error for location:default/loc-3: 403 rate limited for acme-3',
    ]);
  });

  it('does not look up onboarding PRs for repos that already have a link', async () => {
    const findOpenOnboardingPr = jest.fn();
    const { builder } = createHarness({
      repoCount: 5,
      maxConcurrency: 2,
      openPrLookup: { findOpenOnboardingPr },
    });

    const repos = await builder.buildAllRepos();

    expect(repos.every(r => r.taxonomyStatus?.kind !== 'Missing')).toBe(true);
    expect(findOpenOnboardingPr).not.toHaveBeenCalled();
  });
});

describe('buildRepo', () => {
  beforeEach(() => {
    global.fetch = jest
      .fn()
      .mockImplementation(async () =>
        metaResponse(),
      ) as unknown as typeof fetch;
  });

  const selectorFor = (index: number) => ({
    host: 'github.com',
    org: `acme-${index}`,
    name: 'widget',
    path: 'catalog-info.yaml',
  });

  /** `lastSeen` is wall-clock, so it differs between two runs of the same fixture. */
  const withoutLastSeen = ({ lastSeen: _lastSeen, ...rest }: Repo) => rest;

  it('resolves one row without sweeping the other repos', async () => {
    const { builder, catalogRequests, probedUrls } = createHarness({
      repoCount: 50,
    });

    const repo = await builder.buildRepo(selectorFor(7));

    expect(repo?.org).toBe('acme-7');
    expect(probedUrls).toEqual([locationTargetOf(7)]);
    // Every outbound GitHub call is about the selected repo — the other 49 are
    // never touched.
    const fetchedUrls = (global.fetch as jest.Mock).mock.calls.map(
      ([url]) => `${url}`,
    );
    expect(fetchedUrls.length).toBeGreaterThan(0);
    expect(fetchedUrls.every(url => url.includes('acme-7'))).toBe(true);
    // Every catalog read is filtered; an unfiltered one would pull the whole
    // catalog back into the request, which is exactly what this task removed.
    expect(
      catalogRequests.every(
        request => Object.keys(request.filter ?? {}).length > 0,
      ),
    ).toBe(true);
  });

  it('returns undefined when no Location projects to the selector', async () => {
    const { builder } = createHarness({ repoCount: 5 });

    expect(await builder.buildRepo(selectorFor(99))).toBeUndefined();
  });

  it('matches the sweep result for a repo with children', async () => {
    const fixture = { repoCount: 10, childIndexes: [3] };
    const swept = await createHarness(fixture).builder.buildAllRepos();
    const single = await createHarness(fixture).builder.buildRepo(
      selectorFor(3),
    );

    expect(single!.status).toBe('present');
    expect(single!.childCount).toBe(1);
    expect(withoutLastSeen(single!)).toEqual(
      withoutLastSeen(swept.find(r => r.org === 'acme-3')!),
    );
  });

  it('matches the sweep result for a repo with no children', async () => {
    const fixture = { repoCount: 10, childIndexes: [3] };
    const swept = await createHarness(fixture).builder.buildAllRepos();
    const single = await createHarness(fixture).builder.buildRepo(
      selectorFor(5),
    );

    expect(single!.status).toBe('missing');
    expect(withoutLastSeen(single!)).toEqual(
      withoutLastSeen(swept.find(r => r.org === 'acme-5')!),
    );
  });
});
