import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BulkBar } from './BulkBar';

const DEFAULT_PROPS = {
  selectedCount: 0,
  hasNonMissingSelected: false,
  onStart: jest.fn(),
  onClearSelection: jest.fn(),
  onSelectAllMissing: jest.fn(),
};

describe('BulkBar', () => {
  it('renders nothing when selectedCount is 0', () => {
    const { container } = render(
      <BulkBar {...DEFAULT_PROPS} selectedCount={0} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('shows the count in the onboard button when repos are selected', () => {
    render(<BulkBar {...DEFAULT_PROPS} selectedCount={3} />);
    expect(screen.getByText(/Onboard 3 repos/i)).toBeInTheDocument();
  });

  it('shows the selected count in the summary text', () => {
    render(<BulkBar {...DEFAULT_PROPS} selectedCount={5} />);
    expect(screen.getByText('5', { exact: true })).toBeInTheDocument();
    expect(screen.getByText(/repos selected/i)).toBeInTheDocument();
  });

  it('disables the onboard button when hasNonMissingSelected is true', () => {
    render(
      <BulkBar {...DEFAULT_PROPS} selectedCount={2} hasNonMissingSelected />,
    );
    const button = screen.getByText(/Onboard 2 repos/i).closest('button');
    expect(button).toBeDisabled();
  });

  it('enables the onboard button when hasNonMissingSelected is false', () => {
    render(
      <BulkBar
        {...DEFAULT_PROPS}
        selectedCount={2}
        hasNonMissingSelected={false}
      />,
    );
    const button = screen.getByText(/Onboard 2 repos/i).closest('button');
    expect(button).not.toBeDisabled();
  });

  it('calls onClearSelection when Clear selection is clicked', async () => {
    const onClearSelection = jest.fn();
    render(
      <BulkBar
        {...DEFAULT_PROPS}
        selectedCount={2}
        onClearSelection={onClearSelection}
      />,
    );
    await userEvent.click(screen.getByText(/Clear selection/i));
    expect(onClearSelection).toHaveBeenCalledTimes(1);
  });

  it('calls onSelectAllMissing when select all button is clicked', async () => {
    const onSelectAllMissing = jest.fn();
    render(
      <BulkBar
        {...DEFAULT_PROPS}
        selectedCount={2}
        onSelectAllMissing={onSelectAllMissing}
      />,
    );
    await userEvent.click(screen.getByText(/Select all visible Missing/i));
    expect(onSelectAllMissing).toHaveBeenCalledTimes(1);
  });

  it('calls onStart when onboard button is clicked and enabled', async () => {
    const onStart = jest.fn();
    render(
      <BulkBar
        {...DEFAULT_PROPS}
        selectedCount={1}
        hasNonMissingSelected={false}
        onStart={onStart}
      />,
    );
    await userEvent.click(screen.getByText(/Onboard 1 repos/i));
    expect(onStart).toHaveBeenCalledTimes(1);
  });

  describe('allowDirectCommit prop', () => {
    it('does NOT show Commit directly button when allowDirectCommit is false (default)', () => {
      render(<BulkBar {...DEFAULT_PROPS} selectedCount={2} />);
      expect(screen.queryByText(/Commit directly/i)).not.toBeInTheDocument();
    });

    it('shows Commit directly button when allowDirectCommit is true', () => {
      render(
        <BulkBar
          {...DEFAULT_PROPS}
          selectedCount={3}
          allowDirectCommit
          onCommitDirectBulk={jest.fn()}
        />,
      );
      expect(screen.getByText(/Commit directly \(3\)/i)).toBeInTheDocument();
    });

    it('calls onCommitDirectBulk when Commit directly button is clicked', async () => {
      const onCommitDirectBulk = jest.fn();
      render(
        <BulkBar
          {...DEFAULT_PROPS}
          selectedCount={2}
          hasNonMissingSelected={false}
          allowDirectCommit
          onCommitDirectBulk={onCommitDirectBulk}
        />,
      );
      await userEvent.click(screen.getByText(/Commit directly \(2\)/i));
      expect(onCommitDirectBulk).toHaveBeenCalledTimes(1);
    });

    it('disables Commit directly button when hasNonMissingSelected is true', () => {
      render(
        <BulkBar
          {...DEFAULT_PROPS}
          selectedCount={2}
          hasNonMissingSelected
          allowDirectCommit
          onCommitDirectBulk={jest.fn()}
        />,
      );
      const btn = screen.getByText(/Commit directly \(2\)/i).closest('button');
      expect(btn).toBeDisabled();
    });
  });
});
