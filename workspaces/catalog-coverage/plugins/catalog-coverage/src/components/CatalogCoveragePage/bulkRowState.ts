/**
 * Pure row-state transitions for a bulk onboarding job.
 *
 * Extracted from useBulkOrchestrator so the hook stays within the 250-line
 * limit and so the transitions can be unit-tested without React.
 */
import { BulkJobState, BulkRowState } from '../../lib/BulkStateManager';
import {
  BulkProgressEvent,
  BulkRequest,
} from '../../lib/OnboardingOrchestrator';

/** Stable identity of a row: `owner/repo`. */
export const rowKey = (owner: string, repo: string): string =>
  `${owner}/${repo}`;

/** Maps a finished-event result onto the row state it implies. */
const stateFromResult = (
  result: Extract<BulkProgressEvent, { type: 'finished' }>['result'],
): BulkRowState => {
  switch (result.kind) {
    case 'success':
      return { status: 'done', prUrl: result.prUrl };
    case 'skipped':
      return { status: 'skipped', prUrl: result.prUrl };
    case 'failed-retry':
      return { status: 'failed-retry', reason: result.reason };
    default:
      return { status: 'failed-perm', reason: result.reason };
  }
};

/** Returns a copy of the job with one row's state replaced. */
export const withRowState = (
  job: BulkJobState,
  owner: string,
  repo: string,
  state: BulkRowState,
): BulkJobState => ({
  ...job,
  rows: job.rows.map(row =>
    row.owner === owner && row.repo === repo ? { ...row, state } : row,
  ),
});

/** Updates a job snapshot with a single progress event. */
export const applyEvent = (
  job: BulkJobState,
  event: BulkProgressEvent,
): BulkJobState =>
  withRowState(
    job,
    event.owner,
    event.repo,
    event.type === 'started'
      ? { status: 'in-flight' }
      : stateFromResult(event.result),
  );

/**
 * Rows for the next run: every row in `requests` is reset to `pending`, all
 * other rows keep the state they already had. With no previous job, the
 * requests themselves become the rows.
 */
export const mergeRowsForRun = (
  requests: Array<BulkRequest>,
  existingJob?: BulkJobState,
): BulkJobState['rows'] => {
  const inBatch = new Set(requests.map(r => rowKey(r.owner, r.repo)));
  if (!existingJob) {
    return requests.map(r => ({
      owner: r.owner,
      repo: r.repo,
      state: { status: 'pending' as const },
    }));
  }
  return existingJob.rows.map(row =>
    inBatch.has(rowKey(row.owner, row.repo))
      ? { ...row, state: { status: 'pending' as const } }
      : row,
  );
};
