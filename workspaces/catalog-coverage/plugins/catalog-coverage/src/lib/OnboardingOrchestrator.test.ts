import {
  CatalogImportApi,
  OnboardingOrchestrator,
} from './OnboardingOrchestrator';

const OWNER = 'zentala';
const REPO = 'my-repo';
const YAML = 'apiVersion: backstage.io/v1alpha1\nkind: Component\n';
const PR_LINK = 'https://github.com/zentala/my-repo/pull/42';

const makeMockApi = (
  override?: Partial<CatalogImportApi>,
): CatalogImportApi => ({
  submitPullRequest: jest.fn().mockResolvedValue({
    link: PR_LINK,
    location: 'github.com/zentala/my-repo',
  }),
  ...override,
});

const makeError = (statusCode?: number, name?: string): Error => {
  const err = new Error('API error') as Error & {
    statusCode?: number;
    name: string;
  };
  if (statusCode !== undefined) err.statusCode = statusCode;
  if (name) err.name = name;
  return err;
};

describe('OnboardingOrchestrator', () => {
  it('returns success with prUrl on successful submitPullRequest', async () => {
    const api = makeMockApi();
    const orchestrator = new OnboardingOrchestrator(api);
    const result = await orchestrator.onboardSingle(OWNER, REPO, YAML);

    expect(result).toEqual({ kind: 'success', prUrl: PR_LINK });
    expect(api.submitPullRequest).toHaveBeenCalledWith({
      repositoryUrl: `https://github.com/${OWNER}/${REPO}`,
      fileContent: YAML,
      title: 'chore: register in Backstage catalog',
      body: expect.any(String),
    });
  });

  it('accepts custom title and body', async () => {
    const api = makeMockApi();
    const orchestrator = new OnboardingOrchestrator(api);
    await orchestrator.onboardSingle(
      OWNER,
      REPO,
      YAML,
      'custom title',
      'custom body',
    );

    expect(api.submitPullRequest).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'custom title', body: 'custom body' }),
    );
  });

  it('returns skipped when submitPullRequest throws 422', async () => {
    const api = makeMockApi({
      submitPullRequest: jest.fn().mockRejectedValue(makeError(422)),
    });
    const orchestrator = new OnboardingOrchestrator(api);
    const result = await orchestrator.onboardSingle(OWNER, REPO, YAML);

    expect(result.kind).toBe('skipped');
    expect((result as { reason: string }).reason).toBe('pr-exists');
  });

  it('returns skipped when submitPullRequest throws ConflictError', async () => {
    const api = makeMockApi({
      submitPullRequest: jest
        .fn()
        .mockRejectedValue(makeError(undefined, 'ConflictError')),
    });
    const orchestrator = new OnboardingOrchestrator(api);
    const result = await orchestrator.onboardSingle(OWNER, REPO, YAML);

    expect(result.kind).toBe('skipped');
    expect((result as { reason: string }).reason).toBe('pr-exists');
  });

  it('returns failed-retry when submitPullRequest throws 429', async () => {
    const api = makeMockApi({
      submitPullRequest: jest.fn().mockRejectedValue(makeError(429)),
    });
    const orchestrator = new OnboardingOrchestrator(api);
    const result = await orchestrator.onboardSingle(OWNER, REPO, YAML);

    expect(result.kind).toBe('failed-retry');
    expect((result as { nextAttemptAt?: Date }).nextAttemptAt).toBeInstanceOf(
      Date,
    );
  });

  it('returns failed-retry with "Network timeout" on AbortError', async () => {
    const api = makeMockApi({
      submitPullRequest: jest
        .fn()
        .mockRejectedValue(makeError(undefined, 'AbortError')),
    });
    const orchestrator = new OnboardingOrchestrator(api);
    const result = await orchestrator.onboardSingle(OWNER, REPO, YAML);

    expect(result.kind).toBe('failed-retry');
    expect((result as { reason: string }).reason).toBe('Network timeout');
  });

  it('returns failed-perm when submitPullRequest throws 403', async () => {
    const api = makeMockApi({
      submitPullRequest: jest.fn().mockRejectedValue(makeError(403)),
    });
    const orchestrator = new OnboardingOrchestrator(api);
    const result = await orchestrator.onboardSingle(OWNER, REPO, YAML);

    expect(result.kind).toBe('failed-perm');
    expect((result as { reason: string }).reason).toContain("'repo' scope");
  });

  it('returns failed-perm for unknown errors', async () => {
    const err = new Error('Something went wrong');
    const api = makeMockApi({
      submitPullRequest: jest.fn().mockRejectedValue(err),
    });
    const orchestrator = new OnboardingOrchestrator(api);
    const result = await orchestrator.onboardSingle(OWNER, REPO, YAML);

    expect(result.kind).toBe('failed-perm');
    expect((result as { reason: string }).reason).toBe('Something went wrong');
  });
});

describe('OnboardingOrchestrator.onboardBulk', () => {
  const collectEvents = async (
    orchestrator: OnboardingOrchestrator,
    repos: Array<{ owner: string; repo: string; yaml: string }>,
    signal?: AbortSignal,
  ) => {
    const events = [];
    for await (const event of orchestrator.onboardBulk(repos, signal)) {
      events.push(event);
    }
    return events;
  };

  it('emits started + finished events for each repo in order', async () => {
    const api = makeMockApi({
      submitPullRequest: jest.fn().mockResolvedValue({
        link: PR_LINK,
        location: 'github.com/zentala/my-repo',
      }),
    });
    const orchestrator = new OnboardingOrchestrator(api);
    const repos = [
      { owner: 'org', repo: 'repo-a', yaml: YAML },
      { owner: 'org', repo: 'repo-b', yaml: YAML },
      { owner: 'org', repo: 'repo-c', yaml: YAML },
    ];

    const events = await collectEvents(orchestrator, repos);

    expect(events).toHaveLength(6);
    expect(events[0]).toEqual({
      type: 'started',
      owner: 'org',
      repo: 'repo-a',
    });
    expect(events[1]).toMatchObject({
      type: 'finished',
      owner: 'org',
      repo: 'repo-a',
    });
    expect(events[2]).toEqual({
      type: 'started',
      owner: 'org',
      repo: 'repo-b',
    });
    expect(events[4]).toEqual({
      type: 'started',
      owner: 'org',
      repo: 'repo-c',
    });
  });

  it('maps success result correctly in finished event', async () => {
    const api = makeMockApi({
      submitPullRequest: jest.fn().mockResolvedValue({
        link: PR_LINK,
        location: 'github.com/zentala/my-repo',
      }),
    });
    const orchestrator = new OnboardingOrchestrator(api);
    const events = await collectEvents(orchestrator, [
      { owner: 'org', repo: 'repo-a', yaml: YAML },
    ]);

    const finished = events.find(e => e.type === 'finished') as {
      type: 'finished';
      result: { kind: string; prUrl?: string };
    };
    expect(finished.result.kind).toBe('success');
    expect(finished.result.prUrl).toBe(PR_LINK);
  });

  it('maps failed-perm result correctly in finished event', async () => {
    const api = makeMockApi({
      submitPullRequest: jest.fn().mockRejectedValue(makeError(403)),
    });
    const orchestrator = new OnboardingOrchestrator(api);
    const events = await collectEvents(orchestrator, [
      { owner: 'org', repo: 'repo-a', yaml: YAML },
    ]);

    const finished = events.find(e => e.type === 'finished') as {
      type: 'finished';
      result: { kind: string; reason: string };
    };
    expect(finished.result.kind).toBe('failed-perm');
    expect(finished.result.reason).toContain("'repo' scope");
  });

  it('stops emitting events after abort signal fires', async () => {
    const api = makeMockApi({
      submitPullRequest: jest.fn().mockResolvedValue({
        link: PR_LINK,
        location: 'github.com/zentala/my-repo',
      }),
    });
    const orchestrator = new OnboardingOrchestrator(api);
    const ctrl = new AbortController();

    const repos = [
      { owner: 'org', repo: 'repo-a', yaml: YAML },
      { owner: 'org', repo: 'repo-b', yaml: YAML },
      { owner: 'org', repo: 'repo-c', yaml: YAML },
    ];

    const events = [];
    for await (const event of orchestrator.onboardBulk(repos, ctrl.signal)) {
      events.push(event);
      // Abort after the first repo finishes
      if (event.type === 'finished' && event.repo === 'repo-a') {
        ctrl.abort();
      }
    }

    // Should have started+finished for repo-a only, then stopped
    expect(events.filter(e => e.repo === 'repo-a')).toHaveLength(2);
    expect(events.filter(e => e.repo === 'repo-b')).toHaveLength(0);
  });
});
