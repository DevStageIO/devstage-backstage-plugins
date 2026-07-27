/**
 * useBulkOrchestrator — manages state and logic for the bulk onboarding flow.
 *
 * Extracted from CatalogCoveragePage to stay within the 250-line limit.
 * Row-state transitions live in bulkRowState.ts.
 */
import { useEffect, useRef, useState } from 'react';
import { CatalogCoverageApi } from '../../api/CatalogCoverageApi';
import { Repo } from '../../data/types';
import {
  BulkJobState,
  BulkStateManager,
  isJobComplete,
} from '../../lib/BulkStateManager';
import {
  BulkRequest,
  OnboardingOrchestrator,
  CatalogImportApi,
} from '../../lib/OnboardingOrchestrator';
import { applyEvent, mergeRowsForRun, rowKey, withRowState } from './bulkRowState';

/** Returns true when the repo still needs onboarding. */
export const isMissingStatus = (repo: Repo): boolean =>
  repo.status === 'missing';

/** Best-effort message for an unknown thrown value. */
const errorReason = (err: unknown): string =>
  err instanceof Error ? err.message : String(err);

export interface BulkOrchestratorResult {
  bulkJob: BulkJobState | null;
  bulkDrawerOpen: boolean;
  isPaused: boolean;
  /** Repos awaiting user confirmation before onboarding starts. Null when not in confirmation phase. */
  confirmPending: Array<{ owner: string; repo: string }> | null;
  /** YAML of the first pending repo at confirm time — shown as preview in drawer. Null outside confirm phase. */
  confirmYamlPreview: string | null;
  startBulk: (
    filteredRepos: Array<Repo>,
    selectedRepoKeys: Set<string>,
  ) => Promise<void>;
  /** Confirms the pending repos and starts the actual onboarding process. */
  confirmBulk: () => void;
  handlePause: () => void;
  handleResume: () => void;
  closeBulkDrawer: () => void;
  /** Re-runs onboarding for one failed row, leaving every other row untouched. */
  handleRetry: (owner: string, repo: string) => Promise<void>;
}

/**
 * Hook that encapsulates all bulk onboarding state and side effects.
 *
 * Both APIs are taken as arguments rather than captured during `startBulk`, so
 * Retry and Resume also work on a job restored from sessionStorage after a page
 * reload — with captured refs those controls were rendered but inert.
 */
export const useBulkOrchestrator = (
  api: CatalogCoverageApi,
  catalogImportApi: CatalogImportApi,
): BulkOrchestratorResult => {
  const [bulkJob, setBulkJob] = useState<BulkJobState | null>(null);
  const [bulkDrawerOpen, setBulkDrawerOpen] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [confirmPending, setConfirmPending] = useState<Array<{
    owner: string;
    repo: string;
  }> | null>(null);
  const [confirmYamlPreview, setConfirmYamlPreview] = useState<string | null>(
    null,
  );
  const abortRef = useRef<AbortController | null>(null);
  const confirmRequestsRef = useRef<Array<BulkRequest> | null>(null);
  /** YAML per row, kept so pause/resume and retry can re-submit without re-fetching. */
  const requestCacheRef = useRef<Map<string, BulkRequest>>(new Map());
  /** Mirrors bulkJob so async handlers never act on a stale closure. */
  const jobRef = useRef<BulkJobState | null>(null);

  /** Single place that state, ref and sessionStorage are kept in sync. */
  const commitJob = (job: BulkJobState): void => {
    jobRef.current = job;
    setBulkJob({ ...job });
    BulkStateManager.save(job);
  };

  // Restore an in-progress job from sessionStorage on mount.
  useEffect(() => {
    const saved = BulkStateManager.load();
    if (saved && !saved.completedAt) {
      jobRef.current = saved;
      setBulkJob(saved);
      setBulkDrawerOpen(true);
      setIsPaused(true);
    }
  }, []);

  const cacheRequests = (requests: Array<BulkRequest>): void => {
    for (const request of requests) {
      requestCacheRef.current.set(rowKey(request.owner, request.repo), request);
    }
  };

  /**
   * Returns a BulkRequest per target, fetching a fresh suggestion for any row
   * whose YAML is not cached (the case after a page reload).
   */
  const resolveRequests = async (
    targets: Array<{ owner: string; repo: string }>,
  ): Promise<Array<BulkRequest>> => {
    const cache = requestCacheRef.current;
    const uncached = targets.filter(t => !cache.has(rowKey(t.owner, t.repo)));
    if (uncached.length > 0) {
      const suggestions = await api.getSuggestionsBatch(
        uncached.map(t => `${t.owner}/${t.repo}`),
      );
      cacheRequests(
        suggestions.map(s => ({ owner: s.owner, repo: s.repo, yaml: s.yaml })),
      );
    }
    return targets
      .map(t => cache.get(rowKey(t.owner, t.repo)))
      .filter((r): r is BulkRequest => r !== undefined);
  };

  const runBulkRequests = async (
    requests: Array<BulkRequest>,
    existingJob?: BulkJobState,
  ): Promise<void> => {
    cacheRequests(requests);

    const initialJob: BulkJobState = {
      rows: mergeRowsForRun(requests, existingJob),
      startedAt: existingJob?.startedAt ?? new Date().toISOString(),
    };
    setIsPaused(false);
    commitJob(initialJob);

    const ctrl = new AbortController();
    abortRef.current = ctrl;
    const orchestrator = new OnboardingOrchestrator(catalogImportApi);

    let current = initialJob;
    for await (const event of orchestrator.onboardBulk(requests, ctrl.signal)) {
      current = applyEvent(current, event);
      commitJob(current);
    }

    // Only a genuinely finished job gets completedAt: a run stopped by Pause
    // leaves rows pending, and marking it complete would make the mount-time
    // restore skip it, so Resume after a reload would have nothing to resume.
    commitJob(
      isJobComplete(current)
        ? { ...current, completedAt: new Date().toISOString() }
        : current,
    );
  };

  const startBulk = async (
    filteredRepos: Array<Repo>,
    selectedRepoKeys: Set<string>,
  ): Promise<void> => {
    const selectedMissing = filteredRepos.filter(
      r => selectedRepoKeys.has(`${r.org}/${r.name}`) && isMissingStatus(r),
    );
    if (selectedMissing.length === 0) return;

    const refs = selectedMissing.map(r => `${r.org}/${r.name}`);
    const suggestions = await api.getSuggestionsBatch(refs);
    const bulkRequests: Array<BulkRequest> = suggestions.map(s => ({
      owner: s.owner,
      repo: s.repo,
      yaml: s.yaml,
    }));

    confirmRequestsRef.current = bulkRequests;
    setConfirmYamlPreview(bulkRequests[0]?.yaml ?? null);
    setConfirmPending(
      bulkRequests.map(r => ({ owner: r.owner, repo: r.repo })),
    );
    setBulkDrawerOpen(true);
  };

  const confirmBulk = (): void => {
    const requests = confirmRequestsRef.current;
    if (!requests || requests.length === 0) return;
    setConfirmPending(null);
    setConfirmYamlPreview(null);
    confirmRequestsRef.current = null;
    runBulkRequests(requests).catch(() => {
      // errors captured in individual row states
    });
  };

  const handlePause = () => {
    setIsPaused(true);
    abortRef.current?.abort();
  };

  const handleResume = () => {
    const currentJob = jobRef.current;
    if (!currentJob) return;
    setIsPaused(false);
    const pending = currentJob.rows.filter(r => r.state.status === 'pending');
    if (pending.length === 0) return;
    resolveRequests(pending)
      .then(requests => runBulkRequests(requests, jobRef.current ?? undefined))
      .catch(() => {});
  };

  const closeBulkDrawer = () => {
    setBulkDrawerOpen(false);
    setConfirmPending(null);
    setConfirmYamlPreview(null);
    confirmRequestsRef.current = null;
  };

  /**
   * Re-runs the single-repo onboarding path for one row. Goes through the same
   * OnboardingOrchestrator (and therefore the same backend authz guard) as the
   * original attempt; a rejection lands back on the row as a visible reason
   * rather than being swallowed.
   */
  const handleRetry = async (owner: string, repo: string): Promise<void> => {
    const currentJob = jobRef.current;
    if (!currentJob) return;
    commitJob(withRowState(currentJob, owner, repo, { status: 'in-flight' }));
    try {
      const [request] = await resolveRequests([{ owner, repo }]);
      if (!request) {
        throw new Error('No catalog-info.yaml suggestion available');
      }
      await runBulkRequests([request], jobRef.current ?? undefined);
    } catch (err) {
      const job = jobRef.current;
      if (!job) return;
      commitJob(
        withRowState(job, owner, repo, {
          status: 'failed-retry',
          reason: errorReason(err),
        }),
      );
    }
  };

  return {
    bulkJob,
    bulkDrawerOpen,
    isPaused,
    confirmPending,
    confirmYamlPreview,
    startBulk,
    confirmBulk,
    handlePause,
    handleResume,
    closeBulkDrawer,
    handleRetry,
  };
};
