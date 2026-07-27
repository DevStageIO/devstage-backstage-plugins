/**
 * BulkStateManager — sessionStorage persistence for bulk onboarding job state.
 *
 * Allows resuming a bulk job after a page reload or tab switch.
 */

const STORAGE_KEY = 'catalog-coverage.bulk-state';

/** Per-row onboarding status in a bulk job. */
export type BulkRowState =
  | { status: 'pending' }
  | { status: 'in-flight' }
  | { status: 'done'; prUrl: string }
  | { status: 'skipped'; prUrl?: string }
  | { status: 'failed-retry'; reason: string }
  | { status: 'failed-perm'; reason: string };

/** Full state of a bulk onboarding job, suitable for sessionStorage. */
export type BulkJobState = {
  rows: Array<{ owner: string; repo: string; state: BulkRowState }>;
  /** ISO timestamp when the job started. */
  startedAt: string;
  /** ISO timestamp when all rows reached terminal state; undefined while running. */
  completedAt?: string;
};

/** Terminal statuses — once reached, a row will not change. */
export const TERMINAL_STATUSES: Array<BulkRowState['status']> = [
  'done',
  'skipped',
  'failed-perm',
];

/** Returns true if every row in the job has reached a terminal state. */
export const isJobComplete = (job: BulkJobState): boolean =>
  job.rows.every(r => TERMINAL_STATUSES.includes(r.state.status));

/** Utilities for reading and writing bulk job state to sessionStorage. */
export const BulkStateManager = {
  /** Persist the current job state. */
  save(state: BulkJobState): void {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  },

  /** Load a previously saved job state, or null if none exists. */
  load(): BulkJobState | null {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as BulkJobState;
    } catch {
      return null;
    }
  },

  /** Remove the saved job state. */
  clear(): void {
    sessionStorage.removeItem(STORAGE_KEY);
  },
};
