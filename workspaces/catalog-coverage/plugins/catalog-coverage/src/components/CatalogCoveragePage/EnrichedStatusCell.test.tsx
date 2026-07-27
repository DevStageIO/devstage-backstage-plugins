import { render, screen } from '@testing-library/react';
import { wrapInTestApp } from '@backstage/test-utils';
import { EnrichedStatusCell } from './EnrichedStatusCell';
import { CatalogEntity, Repo } from '../../data/types';

const CLASSES = {
  badgePresent: 'badgePresent',
  badgeMissing: 'badgeMissing',
  badgeInvalid: 'badgeInvalid',
  branchHint: 'branchHint',
};

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

const COMPONENT_ENTITY: CatalogEntity = {
  kind: 'Component',
  metadata: { name: 'my-repo', namespace: 'default' },
};

const renderCell = (
  overrides: Partial<Repo> = {},
  entities: Array<CatalogEntity> = [],
) =>
  render(
    wrapInTestApp(
      <EnrichedStatusCell
        row={{ ...BASE_REPO, ...overrides }}
        classes={CLASSES}
        entities={entities}
      />,
    ),
  );

describe('EnrichedStatusCell — pure renderer (no useApi/useAsync)', () => {
  it('renders the Present badge with no entity chips when entities is empty', () => {
    renderCell({ status: 'present' }, []);
    expect(screen.getByText('Present')).toBeInTheDocument();
    expect(screen.queryByText('Component')).not.toBeInTheDocument();
  });

  it('renders Present badge + entity chip + link when entities has an item', () => {
    renderCell({ status: 'present' }, [COMPONENT_ENTITY]);
    expect(screen.getByText('Present')).toBeInTheDocument();
    expect(screen.getByText('Component')).toBeInTheDocument();
    const link = screen.getByRole('link', { name: 'my-repo' });
    expect(link).toHaveAttribute('href', '/catalog/default/component/my-repo');
  });

  it('renders Invalid badge + entity name + YAML error chip', () => {
    renderCell({ status: 'invalid' }, [COMPONENT_ENTITY]);
    expect(screen.getByText('Invalid')).toBeInTheDocument();
    expect(screen.getByText('my-repo')).toBeInTheDocument();
    expect(screen.getByText('YAML error')).toBeInTheDocument();
  });

  it('renders only the Invalid badge when entities is empty', () => {
    renderCell({ status: 'invalid' }, []);
    expect(screen.getByText('Invalid')).toBeInTheDocument();
    expect(screen.queryByText('YAML error')).not.toBeInTheDocument();
  });

  it('renders only the Missing badge, ignoring any entities passed', () => {
    renderCell({ status: 'missing' }, [COMPONENT_ENTITY]);
    expect(screen.getByText('Missing')).toBeInTheDocument();
    expect(screen.queryByText('Component')).not.toBeInTheDocument();
  });

  it('uses the taxonomy badge for invalid rows with a taxonomyStatus', () => {
    renderCell(
      {
        status: 'invalid',
        taxonomyStatus: { kind: 'Issues', issues: [] },
      },
      [],
    );
    expect(screen.queryByText('Invalid')).not.toBeInTheDocument();
    expect(screen.getByText('Issues')).toBeInTheDocument();
  });

  it('uses the taxonomy badge for Waiting rows regardless of status', () => {
    renderCell(
      {
        status: 'missing',
        taxonomyStatus: { kind: 'Waiting' },
      },
      [],
    );
    expect(screen.queryByText('Missing')).not.toBeInTheDocument();
    expect(screen.getByText('Waiting')).toBeInTheDocument();
  });
});
