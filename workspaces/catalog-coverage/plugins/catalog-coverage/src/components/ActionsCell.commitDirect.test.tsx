import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ActionsCell, ActionsCellProps } from './ActionsCell';

const defaultLinks: ActionsCellProps['links'] = {
  openRepo: 'https://github.com/zentala/my-repo',
  viewYaml: 'https://github.com/zentala/my-repo/blob/main/catalog-info.yaml',
  createYaml:
    'https://github.com/zentala/my-repo/new/main?filename=catalog-info.yaml',
};

const renderCell = (overrides: Partial<ActionsCellProps> = {}) => {
  const onOnboard = jest.fn();
  const onCreateYaml = jest.fn();
  const onEditMetadata = jest.fn();
  const onCommitDirect = jest.fn();
  const props: ActionsCellProps = {
    links: defaultLinks,
    status: { kind: 'Missing' },
    onOnboard,
    onCreateYaml,
    onEditMetadata,
    onCommitDirect,
    ...overrides,
  };
  const result = render(<ActionsCell {...props} />);
  return { ...result, onOnboard, onCreateYaml, onEditMetadata, onCommitDirect };
};

describe('ActionsCell — allowDirectCommit prop', () => {
  it('does NOT show Commit directly button when allowDirectCommit is false (default)', () => {
    renderCell({ status: { kind: 'Missing' } });
    expect(
      screen.queryByLabelText(/Commit catalog-info.yaml directly/i),
    ).not.toBeInTheDocument();
  });

  it('does NOT show Commit directly button for non-Missing status', () => {
    renderCell({ status: { kind: 'Discovered' }, allowDirectCommit: true });
    expect(
      screen.queryByLabelText(/Commit catalog-info.yaml directly/i),
    ).not.toBeInTheDocument();
  });

  it('shows Commit directly button for Missing status when allowDirectCommit is true', () => {
    renderCell({ status: { kind: 'Missing' }, allowDirectCommit: true });
    expect(
      screen.getByLabelText(
        'Commit catalog-info.yaml directly to the default branch (no PR)',
      ),
    ).toBeInTheDocument();
  });

  it('calls onCommitDirect when Commit directly button is clicked', async () => {
    const user = userEvent.setup();
    const { onCommitDirect } = renderCell({
      status: { kind: 'Missing' },
      allowDirectCommit: true,
    });
    await user.click(
      screen.getByLabelText(
        'Commit catalog-info.yaml directly to the default branch (no PR)',
      ),
    );
    expect(onCommitDirect).toHaveBeenCalledTimes(1);
  });

  it('disables button when branchProtected is true', () => {
    renderCell({
      status: { kind: 'Missing' },
      allowDirectCommit: true,
      branchProtected: true,
    });
    expect(
      screen.getByLabelText(
        'Branch protection active — direct commit disabled',
      ),
    ).toBeDisabled();
  });

  it('enables button when branchProtected is false', () => {
    renderCell({
      status: { kind: 'Missing' },
      allowDirectCommit: true,
      branchProtected: false,
    });
    expect(
      screen.getByLabelText(
        'Commit catalog-info.yaml directly to the default branch (no PR)',
      ),
    ).not.toBeDisabled();
  });

  it('disables button and shows loading label when isCommittingDirect is true', () => {
    renderCell({
      status: { kind: 'Missing' },
      allowDirectCommit: true,
      isCommittingDirect: true,
    });
    expect(
      screen.getByLabelText('Committing to default branch…'),
    ).toBeDisabled();
  });

  it('branchProtected tooltip takes priority over isCommittingDirect', () => {
    renderCell({
      status: { kind: 'Missing' },
      allowDirectCommit: true,
      branchProtected: true,
      isCommittingDirect: true,
    });
    expect(
      screen.getByLabelText(
        'Branch protection active — direct commit disabled',
      ),
    ).toBeDisabled();
  });
});
