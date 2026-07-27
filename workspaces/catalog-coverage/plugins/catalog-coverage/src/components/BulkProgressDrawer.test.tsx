import { useState } from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { BulkProgressDrawer } from './BulkProgressDrawer';
import { BulkJobState, BulkRowState } from '../lib/BulkStateManager';

/** Wrap renders that include BulkConfirmationPhase — it uses Backstage <Link> which needs a router context. */
const renderWithRouter = (ui: React.ReactElement) =>
  render(<MemoryRouter>{ui}</MemoryRouter>);

const DEFAULT_PROPS = {
  open: true,
  job: null,
  isPaused: false,
  onPause: jest.fn(),
  onResume: jest.fn(),
  onClose: jest.fn(),
  onRetry: jest.fn(),
};

const makeJob = (overrides?: Partial<BulkJobState>): BulkJobState => ({
  rows: [],
  startedAt: '2026-04-29T10:00:00.000Z',
  ...overrides,
});

describe('BulkProgressDrawer', () => {
  it('renders "0 done" stats with an empty job', () => {
    render(<BulkProgressDrawer {...DEFAULT_PROPS} job={makeJob()} />);
    expect(screen.getByText(/0 done/i)).toBeInTheDocument();
    expect(screen.getByText(/0 skipped/i)).toBeInTheDocument();
    expect(screen.getByText(/0 failed/i)).toBeInTheDocument();
  });

  it('shows correct done/skipped/failed counts', () => {
    const job = makeJob({
      rows: [
        {
          owner: 'org',
          repo: 'a',
          state: { status: 'done', prUrl: 'https://github.com/pull/1' },
        },
        {
          owner: 'org',
          repo: 'b',
          state: { status: 'done', prUrl: 'https://github.com/pull/2' },
        },
        { owner: 'org', repo: 'e', state: { status: 'skipped' } },
        {
          owner: 'org',
          repo: 'c',
          state: { status: 'failed-perm', reason: 'no scope' },
        },
        { owner: 'org', repo: 'd', state: { status: 'pending' } },
      ],
    });
    render(<BulkProgressDrawer {...DEFAULT_PROPS} job={job} />);
    expect(screen.getByText(/2 done/i)).toBeInTheDocument();
    expect(screen.getByText(/1 skipped/i)).toBeInTheDocument();
    expect(screen.getByText(/1 failed/i)).toBeInTheDocument();
  });

  it('shows "Edit PR" link for skipped rows', () => {
    const job = makeJob({
      rows: [
        {
          owner: 'myorg',
          repo: 'myrepo',
          state: {
            status: 'skipped',
            prUrl: 'https://github.com/myorg/myrepo/pull/5',
          },
        },
      ],
    });
    render(<BulkProgressDrawer {...DEFAULT_PROPS} job={job} />);
    const editPrLink = screen.getByText(/Edit PR/i);
    expect(editPrLink).toBeInTheDocument();
  });

  it('falls back to pulls URL for skipped rows without prUrl', () => {
    const job = makeJob({
      rows: [{ owner: 'myorg', repo: 'myrepo', state: { status: 'skipped' } }],
    });
    render(<BulkProgressDrawer {...DEFAULT_PROPS} job={job} />);
    expect(screen.getByText(/Edit PR/i)).toBeInTheDocument();
  });

  it('shows Retry button for failed-retry rows', () => {
    const job = makeJob({
      rows: [
        {
          owner: 'org',
          repo: 'a',
          state: { status: 'failed-retry', reason: 'rate limited' },
        },
      ],
    });
    render(<BulkProgressDrawer {...DEFAULT_PROPS} job={job} />);
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });

  describe('retry behaviour', () => {
    const failedRows = (): BulkJobState['rows'] => [
      {
        owner: 'myorg',
        repo: 'first',
        state: { status: 'failed-retry', reason: 'timeout' },
      },
      {
        owner: 'myorg',
        repo: 'second',
        state: { status: 'failed-retry', reason: 'rate limited' },
      },
    ];

    /**
     * Drives the drawer from real state so a click is asserted by what the user
     * ends up seeing, not merely by a spy having fired. `onRetryRow` returns the
     * state the retried row settles in, mirroring what useBulkOrchestrator
     * commits back into the job.
     */
    const RetryHarness = ({
      onRetryRow,
    }: {
      onRetryRow: (owner: string, repo: string) => BulkRowState;
    }) => {
      const [job, setJob] = useState<BulkJobState>(
        makeJob({ rows: failedRows() }),
      );
      return (
        <BulkProgressDrawer
          {...DEFAULT_PROPS}
          job={job}
          onRetry={(owner, repo) =>
            setJob(current => ({
              ...current,
              rows: current.rows.map(row =>
                row.owner === owner && row.repo === repo
                  ? { ...row, state: onRetryRow(owner, repo) }
                  : row,
              ),
            }))
          }
        />
      );
    };

    /** Retry button belonging to the row whose primary text is `myorg/<repo>`. */
    const retryButtonFor = (repo: string) =>
      within(
        screen.getByText(`myorg/${repo}`).closest('li') as HTMLElement,
      ).getByRole('button', { name: /retry/i });

    it('passes the clicked row identity to onRetry', async () => {
      const onRetry = jest.fn();
      render(
        <BulkProgressDrawer
          {...DEFAULT_PROPS}
          job={makeJob({ rows: failedRows() })}
          onRetry={onRetry}
        />,
      );
      await userEvent.click(retryButtonFor('second'));
      expect(onRetry).toHaveBeenCalledWith('myorg', 'second');
      expect(onRetry).toHaveBeenCalledTimes(1);
    });

    it('a succeeding retry replaces that row with a PR link and drops its button', async () => {
      render(
        <RetryHarness
          onRetryRow={() => ({
            status: 'done',
            prUrl: 'https://github.com/myorg/first/pull/9',
          })}
        />,
      );

      await userEvent.click(retryButtonFor('first'));

      const firstRow = screen
        .getByText('myorg/first')
        .closest('li') as HTMLElement;
      expect(within(firstRow).getByText('Done')).toBeInTheDocument();
      expect(within(firstRow).getByText(/View PR/i)).toBeInTheDocument();
      expect(
        within(firstRow).queryByRole('button', { name: /retry/i }),
      ).not.toBeInTheDocument();
      expect(screen.getByText(/1 done/i)).toBeInTheDocument();
    });

    it('leaves the other failed row untouched and still retryable', async () => {
      // Absolute URL on purpose: Backstage <Link> only falls back to the router
      // for relative targets, and this harness renders outside a router.
      render(
        <RetryHarness
          onRetryRow={() => ({
            status: 'done',
            prUrl: 'https://github.com/myorg/first/pull/9',
          })}
        />,
      );

      await userEvent.click(retryButtonFor('first'));

      const secondRow = screen
        .getByText('myorg/second')
        .closest('li') as HTMLElement;
      expect(
        within(secondRow).getByText(/Retry: rate limited/i),
      ).toBeInTheDocument();
      expect(
        within(secondRow).getByRole('button', { name: /retry/i }),
      ).toBeInTheDocument();
    });

    it('surfaces the reason when a retry is rejected by the backend', async () => {
      render(
        <RetryHarness
          onRetryRow={() => ({
            status: 'failed-perm',
            reason: "Owner 'myorg' is not in catalogCoverage.allowedOwners",
          })}
        />,
      );

      await userEvent.click(retryButtonFor('first'));

      const firstRow = screen
        .getByText('myorg/first')
        .closest('li') as HTMLElement;
      expect(
        within(firstRow).getByText(/not in catalogCoverage.allowedOwners/i),
      ).toBeInTheDocument();
      // failed-perm is terminal: retrying an authz rejection cannot help.
      expect(
        within(firstRow).queryByRole('button', { name: /retry/i }),
      ).not.toBeInTheDocument();
    });
  });

  it('calls onClose when the close icon button is clicked', async () => {
    const onClose = jest.fn();
    render(
      <BulkProgressDrawer
        {...DEFAULT_PROPS}
        job={makeJob()}
        onClose={onClose}
      />,
    );
    const closeBtn = screen.getByRole('button', { name: /close drawer/i });
    await userEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('shows Pause button when not paused and job not complete', () => {
    const job = makeJob({
      rows: [{ owner: 'org', repo: 'a', state: { status: 'in-flight' } }],
    });
    render(
      <BulkProgressDrawer {...DEFAULT_PROPS} job={job} isPaused={false} />,
    );
    expect(screen.getByText(/pause/i)).toBeInTheDocument();
  });

  it('shows Resume button when paused and job not complete', () => {
    const job = makeJob({
      rows: [{ owner: 'org', repo: 'a', state: { status: 'pending' } }],
    });
    render(<BulkProgressDrawer {...DEFAULT_PROPS} job={job} isPaused />);
    expect(screen.getByText(/resume/i)).toBeInTheDocument();
  });

  it('shows Clear & Close button when all rows are in terminal state', () => {
    const job = makeJob({
      rows: [
        {
          owner: 'org',
          repo: 'a',
          state: { status: 'done', prUrl: 'https://github.com/pull/1' },
        },
        { owner: 'org', repo: 'b', state: { status: 'skipped' } },
        {
          owner: 'org',
          repo: 'c',
          state: { status: 'failed-perm', reason: 'no scope' },
        },
      ],
      completedAt: '2026-04-29T11:00:00.000Z',
    });
    render(<BulkProgressDrawer {...DEFAULT_PROPS} job={job} />);
    expect(screen.getByText(/Clear/i)).toBeInTheDocument();
  });

  describe('confirmation phase', () => {
    const confirmRepos = [
      { owner: 'org', repo: 'alpha' },
      { owner: 'org', repo: 'beta' },
    ];

    it('shows "Confirm Bulk Onboard" header when confirmPending is set and job is null', () => {
      renderWithRouter(
        <BulkProgressDrawer {...DEFAULT_PROPS} confirmPending={confirmRepos} />,
      );
      expect(
        screen.getByRole('heading', { name: /Confirm Bulk Onboard/i }),
      ).toBeInTheDocument();
    });

    it('shows a warning message about public PRs', () => {
      renderWithRouter(
        <BulkProgressDrawer {...DEFAULT_PROPS} confirmPending={confirmRepos} />,
      );
      expect(screen.getByText(/public pull requests/i)).toBeInTheDocument();
      expect(screen.getByText(/default descriptions/i)).toBeInTheDocument();
    });

    it('lists all pending repos', () => {
      renderWithRouter(
        <BulkProgressDrawer {...DEFAULT_PROPS} confirmPending={confirmRepos} />,
      );
      expect(screen.getByText('org/alpha')).toBeInTheDocument();
      expect(screen.getByText('org/beta')).toBeInTheDocument();
    });

    it('shows Cancel and Confirm & Start buttons', () => {
      renderWithRouter(
        <BulkProgressDrawer {...DEFAULT_PROPS} confirmPending={confirmRepos} />,
      );
      expect(
        screen.getByRole('button', { name: /cancel/i }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /confirm & start/i }),
      ).toBeInTheDocument();
    });

    it('calls onConfirm when Confirm & Start is clicked', async () => {
      const onConfirm = jest.fn();
      renderWithRouter(
        <BulkProgressDrawer
          {...DEFAULT_PROPS}
          confirmPending={confirmRepos}
          onConfirm={onConfirm}
        />,
      );
      await userEvent.click(
        screen.getByRole('button', { name: /confirm & start/i }),
      );
      expect(onConfirm).toHaveBeenCalledTimes(1);
    });

    it('calls onClose when Cancel is clicked', async () => {
      const onClose = jest.fn();
      renderWithRouter(
        <BulkProgressDrawer
          {...DEFAULT_PROPS}
          confirmPending={confirmRepos}
          onClose={onClose}
        />,
      );
      await userEvent.click(screen.getByRole('button', { name: /cancel/i }));
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('shows progress view (not confirmation) when job is set even if confirmPending is set', () => {
      const job = makeJob({
        rows: [{ owner: 'org', repo: 'a', state: { status: 'in-flight' } }],
      });
      render(
        <BulkProgressDrawer
          {...DEFAULT_PROPS}
          confirmPending={confirmRepos}
          job={job}
        />,
      );
      expect(screen.getByText(/Bulk Onboard Progress/i)).toBeInTheDocument();
      expect(
        screen.queryByText(/Confirm Bulk Onboard/i),
      ).not.toBeInTheDocument();
    });
  });
});
