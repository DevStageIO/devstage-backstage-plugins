/**
 * Unit tests for CommitDirectConfirmDialog — the confirmation gate shown
 * before the single-row "Commit directly" write (E015-T04).
 */
import { TestApiProvider, wrapInTestApp } from '@backstage/test-utils';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { catalogCoverageApiRef } from '../api/CatalogCoverageApi';
import { CommitDirectConfirmDialog } from './CommitDirectConfirmDialog';

const buildMockApi = (overrides: Partial<Record<string, jest.Mock>> = {}) => ({
  listRepos: jest.fn(),
  getSuggestion: jest
    .fn()
    .mockResolvedValue({ owner: 'org', repo: 'repo', yaml: 'apiVersion: v1', signals: {} }),
  getSuggestionsBatch: jest.fn(),
  onboardRepo: jest.fn(),
  refreshSuggestion: jest.fn(),
  updateRepoMetadata: jest.fn(),
  getConfig: jest.fn(),
  commitDirectRepo: jest.fn(),
  ...overrides,
});

const renderDialog = (
  props: Partial<{ open: boolean }> = {},
  api = buildMockApi(),
) => {
  const onCancel = jest.fn();
  const onConfirm = jest.fn();
  const rendered = render(
    wrapInTestApp(
      <TestApiProvider apis={[[catalogCoverageApiRef, api]]}>
        <CommitDirectConfirmDialog
          open
          owner="org"
          repo="repo"
          branch="main"
          onCancel={onCancel}
          onConfirm={onConfirm}
          {...props}
        />
      </TestApiProvider>,
    ),
  );
  return { ...rendered, onCancel, onConfirm, api };
};

// The YAML preview is syntax-highlighted: "apiVersion: v1" is split across
// several <span> nodes, so a plain text/regex match against a single node
// never matches. Wait on the <code> element's combined textContent instead.
const waitForYamlPreview = async () => {
  // The spinner must go away first — querying for the <code> node while the
  // dialog is still loading can otherwise match a stale node from a previous
  // render, which makes the assertion pass or fail for the wrong reason.
  await screen.findByText(/directly to the main branch/i);
  await waitFor(() => {
    const code = document.querySelector('code.language-yaml');
    expect(code?.textContent).toContain('apiVersion: v1');
  });
};

describe('CommitDirectConfirmDialog', () => {
  // Each test mounts a dialog into a portal; unmount it before the next one.
  afterEach(cleanup);

  it('shows target org/repo, branch, and the YAML preview', async () => {
    await renderDialog();
    expect(await screen.findByText(/org\/repo/)).toBeInTheDocument();
    expect(screen.getByText(/directly to the main branch/i)).toBeInTheDocument();
    await waitForYamlPreview();
  });

  it('cancel performs zero write calls', async () => {
    const { onCancel, onConfirm, api } = await renderDialog();
    await waitForYamlPreview();

    await userEvent.click(screen.getByRole('button', { name: /cancel/i }));

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
    expect(api.commitDirectRepo).not.toHaveBeenCalled();
  });

  it('confirm calls onConfirm exactly once with the fetched YAML', async () => {
    const { onConfirm } = await renderDialog();
    await waitForYamlPreview();

    await userEvent.click(
      screen.getByRole('button', { name: /confirm & commit/i }),
    );

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onConfirm).toHaveBeenCalledWith('apiVersion: v1');
  });

  it('does not render dialog content when open is false', async () => {
    await renderDialog({ open: false });
    expect(screen.queryByText(/directly to the main branch/i)).not.toBeInTheDocument();
  });
});
