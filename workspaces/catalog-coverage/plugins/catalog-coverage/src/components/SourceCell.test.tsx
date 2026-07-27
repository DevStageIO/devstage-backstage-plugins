import { render, screen } from '@testing-library/react';
import { SourceCell, SourceCellProps } from './SourceCell';

const defaultProps: SourceCellProps = {
  provider: 'github',
  owner: 'zentala',
  repo: 'my-repo',
  openRepo: 'https://github.com/zentala/my-repo',
};

const renderCell = (props: Partial<SourceCellProps> = {}) =>
  render(<SourceCell {...defaultProps} {...props} />);

describe('SourceCell', () => {
  it('renders owner/repo text', () => {
    renderCell();
    expect(screen.getByText('zentala/my-repo')).toBeInTheDocument();
  });

  it('renders GitHub icon for github provider', () => {
    renderCell({ provider: 'github' });
    expect(screen.getByTestId('github-icon')).toBeInTheDocument();
  });

  it('renders generic icon for unknown provider', () => {
    renderCell({ provider: 'unknown' });
    expect(screen.getByTestId('unknown-provider-icon')).toBeInTheDocument();
    expect(screen.queryByTestId('github-icon')).not.toBeInTheDocument();
  });

  it('renders generic icon for gitlab provider', () => {
    renderCell({ provider: 'gitlab' });
    expect(screen.getByTestId('gitlab-icon')).toBeInTheDocument();
    expect(screen.queryByTestId('github-icon')).not.toBeInTheDocument();
  });

  it('renders a link with the openRepo URL', () => {
    renderCell();
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', 'https://github.com/zentala/my-repo');
  });

  it('wraps content in the source-cell test id', () => {
    renderCell();
    expect(screen.getByTestId('source-cell')).toBeInTheDocument();
  });
});
