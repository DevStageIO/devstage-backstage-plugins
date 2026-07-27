import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ActionsCell, ActionsCellProps } from './ActionsCell';

const OPEN_REPO_URL = 'https://github.com/zentala/my-repo';
const VIEW_YAML_URL =
  'https://github.com/zentala/my-repo/blob/main/catalog-info.yaml';
const CREATE_YAML_URL =
  'https://github.com/zentala/my-repo/new/main?filename=catalog-info.yaml';

const defaultLinks: ActionsCellProps['links'] = {
  openRepo: OPEN_REPO_URL,
  viewYaml: VIEW_YAML_URL,
  createYaml: CREATE_YAML_URL,
};

const renderCell = (overrides: Partial<ActionsCellProps> = {}) => {
  const onOnboard = jest.fn();
  const onCreateYaml = jest.fn();
  const onEditMetadata = jest.fn();
  const onCommitDirect = jest.fn();
  const props: ActionsCellProps = {
    links: defaultLinks,
    status: { kind: 'Discovered' },
    onOnboard,
    onCreateYaml,
    onEditMetadata,
    onCommitDirect,
    ...overrides,
  };
  const result = render(<ActionsCell {...props} />);
  return { ...result, onOnboard, onCreateYaml, onEditMetadata, onCommitDirect };
};

describe('ActionsCell', () => {
  describe('Discovered status', () => {
    it('shows Open repo and View YAML buttons', () => {
      renderCell({ status: { kind: 'Discovered' } });
      expect(screen.getByLabelText('Open repository')).toBeInTheDocument();
      expect(
        screen.getByLabelText('View catalog-info.yaml'),
      ).toBeInTheDocument();
    });

    it('does NOT show Create YAML or Onboard buttons', () => {
      renderCell({ status: { kind: 'Discovered' } });
      expect(
        screen.queryByLabelText(/pre-filled with AI suggestion/i),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByLabelText(/generate catalog-info.yaml/i),
      ).not.toBeInTheDocument();
    });
  });

  describe('Issues status', () => {
    it('shows Open repo and View YAML buttons', () => {
      renderCell({ status: { kind: 'Issues' } });
      expect(screen.getByLabelText('Open repository')).toBeInTheDocument();
      expect(
        screen.getByLabelText('View catalog-info.yaml'),
      ).toBeInTheDocument();
    });

    it('does NOT show Create YAML or Onboard buttons', () => {
      renderCell({ status: { kind: 'Issues' } });
      expect(
        screen.queryByLabelText(/pre-filled with AI suggestion/i),
      ).not.toBeInTheDocument();
    });
  });

  describe('Missing status', () => {
    it('shows Open repo, Create YAML, and Onboard buttons', () => {
      renderCell({ status: { kind: 'Missing' } });
      expect(screen.getByLabelText('Open repository')).toBeInTheDocument();
      expect(
        screen.getByLabelText(
          'Create catalog-info.yaml on GitHub (pre-filled with AI suggestion)',
        ),
      ).toBeInTheDocument();
      expect(
        screen.getByLabelText(
          'Let Backstage generate catalog-info.yaml and open a PR automatically',
        ),
      ).toBeInTheDocument();
    });

    it('does NOT show View YAML button', () => {
      renderCell({ status: { kind: 'Missing' } });
      expect(
        screen.queryByLabelText('View catalog-info.yaml'),
      ).not.toBeInTheDocument();
    });

    it('does NOT show Create YAML button when createYaml is null', () => {
      renderCell({
        status: { kind: 'Missing' },
        links: { ...defaultLinks, createYaml: null },
      });
      expect(
        screen.queryByLabelText(/pre-filled with AI suggestion/i),
      ).not.toBeInTheDocument();
    });

    it('calls onOnboard exactly once when Onboard button is clicked', async () => {
      const user = userEvent.setup();
      const { onOnboard } = renderCell({ status: { kind: 'Missing' } });
      await user.click(
        screen.getByLabelText(
          'Let Backstage generate catalog-info.yaml and open a PR automatically',
        ),
      );
      expect(onOnboard).toHaveBeenCalledTimes(1);
    });
  });

  describe('Waiting status', () => {
    const PR_URL = 'https://github.com/zentala/my-repo/pull/1';

    it('shows Open repo and Edit PR buttons when prUrl is provided', () => {
      renderCell({ status: { kind: 'Waiting' }, prUrl: PR_URL });
      expect(screen.getByLabelText('Open repository')).toBeInTheDocument();
      expect(
        screen.getByLabelText('View pull request on GitHub'),
      ).toBeInTheDocument();
    });

    it('shows disabled PR button when prUrl is absent', () => {
      renderCell({ status: { kind: 'Waiting' } });
      expect(screen.getByLabelText('Open repository')).toBeInTheDocument();
      const prBtn = screen.getByLabelText('View pull request on GitHub');
      expect(prBtn).toBeInTheDocument();
      expect(prBtn).toBeDisabled();
    });

    it('does NOT show View YAML, Create YAML, Onboard, or Edit metadata', () => {
      renderCell({ status: { kind: 'Waiting' }, prUrl: PR_URL });
      expect(
        screen.queryByLabelText('View catalog-info.yaml'),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByLabelText(/pre-filled with AI suggestion/i),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByLabelText(/generate catalog-info.yaml/i),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByLabelText(/edit repository metadata/i),
      ).not.toBeInTheDocument();
    });

    it('Edit PR button links to prUrl with target="_blank"', () => {
      renderCell({ status: { kind: 'Waiting' }, prUrl: PR_URL });
      const btn = screen.getByLabelText('View pull request on GitHub');
      expect(btn).toHaveAttribute('href', PR_URL);
      expect(btn).toHaveAttribute('target', '_blank');
    });
  });

  describe('Excluded status', () => {
    it('shows only the Open repo button', () => {
      renderCell({ status: { kind: 'Excluded' } });
      expect(screen.getByLabelText('Open repository')).toBeInTheDocument();
      expect(
        screen.queryByLabelText('View catalog-info.yaml'),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByLabelText(/pre-filled with AI suggestion/i),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByLabelText(/generate catalog-info.yaml/i),
      ).not.toBeInTheDocument();
    });
  });

  describe('Disabled state when link is null', () => {
    it('renders View YAML disabled with generic tooltip when viewYaml is null (Discovered)', () => {
      renderCell({
        status: { kind: 'Discovered' },
        links: { ...defaultLinks, viewYaml: null },
      });
      const btn = screen.getByLabelText('View catalog-info.yaml');
      expect(btn).toBeDisabled();
    });

    it('renders View YAML disabled with GitLab tooltip when host is GitLab', () => {
      renderCell({
        status: { kind: 'Discovered' },
        links: {
          openRepo: 'https://gitlab.com/zentala/my-repo',
          viewYaml: null,
          createYaml: null,
        },
      });
      const btn = screen.getByLabelText('View catalog-info.yaml');
      expect(btn).toBeDisabled();
    });
  });

  describe('Link attributes', () => {
    it('Open repo button has target="_blank" and rel="noopener noreferrer"', () => {
      renderCell({ status: { kind: 'Discovered' } });
      const btn = screen.getByLabelText('Open repository');
      expect(btn).toHaveAttribute('target', '_blank');
      expect(btn).toHaveAttribute('rel', 'noopener noreferrer');
    });

    it('View YAML button has target="_blank" and rel="noopener noreferrer"', () => {
      renderCell({ status: { kind: 'Discovered' } });
      const btn = screen.getByLabelText('View catalog-info.yaml');
      expect(btn).toHaveAttribute('target', '_blank');
      expect(btn).toHaveAttribute('rel', 'noopener noreferrer');
    });

    it('calls onCreateYaml exactly once when Create YAML button is clicked', async () => {
      const user = userEvent.setup();
      const { onCreateYaml } = renderCell({ status: { kind: 'Missing' } });
      await user.click(
        screen.getByLabelText(
          'Create catalog-info.yaml on GitHub (pre-filled with AI suggestion)',
        ),
      );
      expect(onCreateYaml).toHaveBeenCalledTimes(1);
    });
  });

  describe('Tooltips', () => {
    it('Open repo button is wrapped in a tooltip', () => {
      renderCell({ status: { kind: 'Discovered' } });
      expect(screen.getByLabelText('Open repository')).toBeInTheDocument();
    });

    it('Onboard button tooltip distinguishes it from Create YAML', () => {
      renderCell({ status: { kind: 'Missing' } });
      expect(
        screen.getByLabelText(
          'Create catalog-info.yaml on GitHub (pre-filled with AI suggestion)',
        ),
      ).toBeInTheDocument();
      expect(
        screen.getByLabelText(
          'Let Backstage generate catalog-info.yaml and open a PR automatically',
        ),
      ).toBeInTheDocument();
    });
  });
});
