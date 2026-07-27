/**
 * Unit tests for useBulkOrchestrator hook.
 *
 * Tests the two-phase flow: confirm → run, plus pause/resume, per-row retry
 * and error handling.
 */
import { renderHook, act } from '@testing-library/react';
import { useBulkOrchestrator } from './useBulkOrchestrator';
import { OnboardingOrchestrator } from '../../lib/OnboardingOrchestrator';
import { BulkJobState, BulkStateManager } from '../../lib/BulkStateManager';
import { Repo } from '../../data/types';

jest.mock('../../lib/OnboardingOrchestrator');

// ─── Fixtures ───────────────────────────────────────────────────────────────

const makeRepo = (
  org: string,
  name: string,
  status: Repo['status'] = 'missing',
): Repo => ({
  org,
  name,
  host: 'github.com',
  branch: 'main',
  path: 'catalog-info.yaml',
  htmlUrl: `https://github.com/${org}/${name}`,
  locationRef: `url:https://github.com/${org}/${name}`,
  status,
  childCount: 0,
  lastSeen: '2026-01-01T00:00:00Z',
});

const REPOS: Array<Repo> = [makeRepo('org', 'alpha'), makeRepo('org', 'beta')];
const SELECTED = new Set(['org/alpha', 'org/beta']);
const SUGGESTIONS = [
  { owner: 'org', repo: 'alpha', yaml: 'yaml-alpha', signals: {} },
  { owner: 'org', repo: 'beta', yaml: 'yaml-beta', signals: {} },
];

const mockApi = {
  getSuggestionsBatch: jest.fn(),
  listRepos: jest.fn(),
  getSuggestion: jest.fn(),
  onboardRepo: jest.fn(),
  refreshSuggestion: jest.fn(),
  updateRepoMetadata: jest.fn(),
  getConfig: jest.fn(),
};

const mockCatalogImportApi = {
  submitPullRequest: jest.fn(),
};

const renderOrchestrator = () =>
  renderHook(() =>
    useBulkOrchestrator(mockApi as any, mockCatalogImportApi),
  );

/** Creates an async generator that yields nothing and resolves immediately. */
async function* emptyGenerator() {}

/** Job snapshot with one failed-retry row, as sessionStorage would hold it. */
const jobWithFailedRow = (): BulkJobState => ({
  startedAt: '2026-01-01T00:00:00Z',
  rows: [
    { owner: 'org', repo: 'alpha', state: { status: 'done', prUrl: 'pr-1' } },
    {
      owner: 'org',
      repo: 'beta',
      state: { status: 'failed-retry', reason: 'Rate limited by GitHub' },
    },
  ],
});

/** Installs an orchestrator mock whose onboardBulk emits the given events. */
const mockOnboardBulk = (
  events: (requests: Array<{ owner: string; repo: string }>) => Array<any>,
) => {
  const onboardBulk = jest.fn(async function* onboardBulkMock(requests: any) {
    for (const event of events(requests)) yield event;
  });
  (
    OnboardingOrchestrator as jest.MockedClass<typeof OnboardingOrchestrator>
  ).mockImplementation(() => ({ onboardBulk } as any));
  return onboardBulk;
};

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('useBulkOrchestrator', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    sessionStorage.clear();

    // Default: getSuggestionsBatch returns suggestions
    mockApi.getSuggestionsBatch.mockResolvedValue(SUGGESTIONS);

    // Default: OnboardingOrchestrator.onboardBulk yields nothing (no-op)
    (
      OnboardingOrchestrator as jest.MockedClass<typeof OnboardingOrchestrator>
    ).mockImplementation(
      () =>
        ({ onboardBulk: jest.fn().mockReturnValue(emptyGenerator()) } as any),
    );
  });

  it('startBulk exposes confirmYamlPreview from the first suggestion', async () => {
    const { result } = renderOrchestrator();

    await act(async () => {
      await result.current.startBulk(REPOS, SELECTED);
    });

    expect(result.current.confirmYamlPreview).toBe('yaml-alpha');
  });

  it('confirmBulk clears confirmYamlPreview', async () => {
    const { result } = renderOrchestrator();

    await act(async () => {
      await result.current.startBulk(REPOS, SELECTED);
    });

    expect(result.current.confirmYamlPreview).toBe('yaml-alpha');

    await act(async () => {
      result.current.confirmBulk();
    });

    expect(result.current.confirmYamlPreview).toBeNull();
  });

  it('startBulk sets confirmPending and opens drawer WITHOUT starting processing', async () => {
    const { result } = renderOrchestrator();

    await act(async () => {
      await result.current.startBulk(REPOS, SELECTED);
    });

    expect(result.current.confirmPending).toEqual([
      { owner: 'org', repo: 'alpha' },
      { owner: 'org', repo: 'beta' },
    ]);
    expect(result.current.bulkDrawerOpen).toBe(true);
    // bulkJob must NOT be set yet — processing hasn't started
    expect(result.current.bulkJob).toBeNull();
    expect(mockCatalogImportApi.submitPullRequest).not.toHaveBeenCalled();
  });

  it('startBulk with no missing repos does nothing', async () => {
    const { result } = renderOrchestrator();

    const presentRepos: Array<Repo> = [makeRepo('org', 'alpha', 'present')];
    const selected = new Set(['org/alpha']);

    await act(async () => {
      await result.current.startBulk(presentRepos, selected);
    });

    expect(result.current.confirmPending).toBeNull();
    expect(result.current.bulkDrawerOpen).toBe(false);
    expect(mockApi.getSuggestionsBatch).not.toHaveBeenCalled();
  });

  it('confirmBulk transitions from confirm phase to job running (clears confirmPending, sets bulkJob)', async () => {
    const { result } = renderOrchestrator();

    await act(async () => {
      await result.current.startBulk(REPOS, SELECTED);
    });

    expect(result.current.confirmPending).not.toBeNull();

    await act(async () => {
      result.current.confirmBulk();
    });

    // After confirm: confirmPending cleared, bulkJob set
    expect(result.current.confirmPending).toBeNull();
    expect(result.current.bulkJob).not.toBeNull();
    expect(result.current.bulkJob?.rows).toHaveLength(2);
  });

  it('closeBulkDrawer clears confirmPending and closes drawer', async () => {
    const { result } = renderOrchestrator();

    await act(async () => {
      await result.current.startBulk(REPOS, SELECTED);
    });

    expect(result.current.bulkDrawerOpen).toBe(true);
    expect(result.current.confirmPending).not.toBeNull();

    act(() => {
      result.current.closeBulkDrawer();
    });

    expect(result.current.bulkDrawerOpen).toBe(false);
    expect(result.current.confirmPending).toBeNull();
  });

  it('startBulk when getSuggestionsBatch throws does not set confirmPending', async () => {
    mockApi.getSuggestionsBatch.mockRejectedValue(new Error('Network error'));

    const { result } = renderOrchestrator();

    await act(async () => {
      await result.current.startBulk(REPOS, SELECTED).catch(() => {});
    });

    // confirmPending must stay null — drawer must NOT open
    expect(result.current.confirmPending).toBeNull();
    expect(result.current.bulkDrawerOpen).toBe(false);
  });

  it('handleResume after handlePause restarts processing of pending rows', async () => {
    mockOnboardBulk(() => [{ type: 'started', owner: 'org', repo: 'alpha' }]);

    const { result } = renderOrchestrator();

    // Start and confirm to begin processing
    await act(async () => {
      await result.current.startBulk(REPOS, SELECTED);
    });

    await act(async () => {
      result.current.confirmBulk();
    });

    // Pause aborts the controller
    act(() => {
      result.current.handlePause();
    });

    expect(result.current.isPaused).toBe(true);

    // Replace orchestrator mock to track the resume call
    const resumeOnboardBulk = mockOnboardBulk(() => []);

    await act(async () => {
      result.current.handleResume();
    });

    expect(result.current.isPaused).toBe(false);
    // onboardBulk must be called again with the still-pending rows
    expect(resumeOnboardBulk).toHaveBeenCalled();
  });

  describe('handleRetry', () => {
    /** Renders a hook whose job was restored from sessionStorage with one failed row. */
    const renderWithFailedRow = () => {
      BulkStateManager.save(jobWithFailedRow());
      return renderOrchestrator();
    };

    it('re-runs onboarding for the retried row only', async () => {
      const onboardBulk = mockOnboardBulk(requests =>
        requests.map(r => ({
          type: 'finished',
          owner: r.owner,
          repo: r.repo,
          result: { kind: 'success', prUrl: 'pr-retry' },
        })),
      );
      mockApi.getSuggestionsBatch.mockResolvedValue([SUGGESTIONS[1]]);

      const { result } = renderWithFailedRow();

      await act(async () => {
        await result.current.handleRetry('org', 'beta');
      });

      expect(onboardBulk).toHaveBeenCalledTimes(1);
      expect(onboardBulk.mock.calls[0][0]).toEqual([
        { owner: 'org', repo: 'beta', yaml: 'yaml-beta' },
      ]);
      // The already-successful row keeps its own state.
      expect(result.current.bulkJob?.rows[0].state).toEqual({
        status: 'done',
        prUrl: 'pr-1',
      });
      expect(result.current.bulkJob?.rows[1].state).toEqual({
        status: 'done',
        prUrl: 'pr-retry',
      });
    });

    it('surfaces a failed retry as the row reason instead of swallowing it', async () => {
      mockOnboardBulk(requests =>
        requests.map(r => ({
          type: 'finished',
          owner: r.owner,
          repo: r.repo,
          result: {
            kind: 'failed-perm',
            reason: "Owner 'org' is not allowed. Check allowedOwners.",
          },
        })),
      );
      mockApi.getSuggestionsBatch.mockResolvedValue([SUGGESTIONS[1]]);

      const { result } = renderWithFailedRow();

      await act(async () => {
        await result.current.handleRetry('org', 'beta');
      });

      expect(result.current.bulkJob?.rows[1].state).toEqual({
        status: 'failed-perm',
        reason: "Owner 'org' is not allowed. Check allowedOwners.",
      });
    });

    it('surfaces a suggestion-fetch failure on the row rather than no-op', async () => {
      mockApi.getSuggestionsBatch.mockRejectedValue(new Error('Backend 503'));

      const { result } = renderWithFailedRow();

      await act(async () => {
        await result.current.handleRetry('org', 'beta');
      });

      expect(result.current.bulkJob?.rows[1].state).toEqual({
        status: 'failed-retry',
        reason: 'Backend 503',
      });
    });

    it('re-fetches the YAML for a job restored after a page reload', async () => {
      const onboardBulk = mockOnboardBulk(() => []);
      mockApi.getSuggestionsBatch.mockResolvedValue([SUGGESTIONS[1]]);

      const { result } = renderWithFailedRow();

      await act(async () => {
        await result.current.handleRetry('org', 'beta');
      });

      // Nothing was cached in this page session, so the YAML must be fetched.
      expect(mockApi.getSuggestionsBatch).toHaveBeenCalledWith(['org/beta']);
      expect(onboardBulk).toHaveBeenCalledTimes(1);
    });

    it('does nothing when there is no job at all', async () => {
      const onboardBulk = mockOnboardBulk(() => []);
      const { result } = renderOrchestrator();

      await act(async () => {
        await result.current.handleRetry('org', 'beta');
      });

      expect(onboardBulk).not.toHaveBeenCalled();
      expect(mockApi.getSuggestionsBatch).not.toHaveBeenCalled();
    });
  });
});
