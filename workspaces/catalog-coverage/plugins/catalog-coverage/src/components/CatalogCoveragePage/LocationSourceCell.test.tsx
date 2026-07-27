import { render, screen } from '@testing-library/react';
import { LocationSourceCell } from './LocationSourceCell';
import { Repo } from '../../data/types';

const BASE_REPO: Repo = {
  name: 'my-repo',
  org: 'zentala',
  host: 'github.com',
  branch: 'main',
  path: 'catalog-info.yaml',
  htmlUrl: 'https://github.com/zentala/my-repo',
  locationRef:
    'url:https://github.com/zentala/my-repo/blob/main/catalog-info.yaml',
  status: 'present',
  childCount: 1,
  lastSeen: '2024-01-01T00:00:00Z',
};

const renderCell = (overrides: Partial<Repo> = {}) =>
  render(<LocationSourceCell row={{ ...BASE_REPO, ...overrides }} />);

describe('LocationSourceCell — stars', () => {
  it('hides star badge when stars is 0', () => {
    renderCell({ stars: 0 });
    expect(screen.queryByTestId('star-count')).not.toBeInTheDocument();
  });

  it('hides star badge when stars is undefined', () => {
    renderCell({ stars: undefined });
    expect(screen.queryByTestId('star-count')).not.toBeInTheDocument();
  });

  it('shows star badge with correct count when stars > 0', () => {
    renderCell({ stars: 42 });
    const badge = screen.getByTestId('star-count');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveTextContent('42');
  });
});

describe('LocationSourceCell — visibility badge', () => {
  it('shows globe icon for public repository', () => {
    renderCell({ visibility: 'public' });
    expect(screen.getByTestId('visibility-badge')).toBeInTheDocument();
    expect(screen.getByTestId('visibility-public-icon')).toBeInTheDocument();
    expect(
      screen.queryByTestId('visibility-private-icon'),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId('visibility-internal-icon'),
    ).not.toBeInTheDocument();
  });

  it('shows lock icon for private repository', () => {
    renderCell({ visibility: 'private' });
    expect(screen.getByTestId('visibility-badge')).toBeInTheDocument();
    expect(screen.getByTestId('visibility-private-icon')).toBeInTheDocument();
    expect(
      screen.queryByTestId('visibility-public-icon'),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId('visibility-internal-icon'),
    ).not.toBeInTheDocument();
  });

  it('shows building icon for internal repository', () => {
    renderCell({ visibility: 'internal' });
    expect(screen.getByTestId('visibility-badge')).toBeInTheDocument();
    expect(screen.getByTestId('visibility-internal-icon')).toBeInTheDocument();
    expect(
      screen.queryByTestId('visibility-public-icon'),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId('visibility-private-icon'),
    ).not.toBeInTheDocument();
  });

  it('hides visibility badge when visibility is undefined', () => {
    renderCell({ visibility: undefined });
    expect(screen.queryByTestId('visibility-badge')).not.toBeInTheDocument();
  });
});

describe('LocationSourceCell — commit count', () => {
  it('hides commit count when commitCount is undefined', () => {
    renderCell({ commitCount: undefined });
    expect(screen.queryByText(/Total commits/i)).not.toBeInTheDocument();
  });

  it('shows raw number for small commit counts', () => {
    renderCell({ commitCount: 500 });
    expect(screen.getByText('500')).toBeInTheDocument();
  });

  it('formats commit count in thousands with one decimal', () => {
    renderCell({ commitCount: 1500 });
    expect(screen.getByText('1.5k')).toBeInTheDocument();
  });

  it('formats commit count in millions with one decimal', () => {
    renderCell({ commitCount: 1_500_000 });
    expect(screen.getByText('1.5M')).toBeInTheDocument();
  });
});

describe('LocationSourceCell — defaultBranch', () => {
  it('shows the provided defaultBranch in line 4', () => {
    renderCell({ defaultBranch: 'develop' });
    expect(screen.getByText(/develop/)).toBeInTheDocument();
  });

  it('falls back to "main" when defaultBranch is undefined', () => {
    renderCell({ defaultBranch: undefined });
    expect(screen.getByText(/main/)).toBeInTheDocument();
  });
});
