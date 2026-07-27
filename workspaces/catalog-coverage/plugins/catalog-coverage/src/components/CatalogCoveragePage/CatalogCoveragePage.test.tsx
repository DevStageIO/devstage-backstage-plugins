import { TestApiProvider, renderInTestApp } from '@backstage/test-utils';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { catalogApiRef } from '@backstage/plugin-catalog-react';
import {
  CatalogCoverageApi,
  catalogCoverageApiRef,
} from '../../api/CatalogCoverageApi';
import { MOCK_REPOS_RESPONSE } from '../../data/mockRepos';
import { CatalogCoveragePage } from './CatalogCoveragePage';

const MOCK_REPOS_WITH_LINKS = {
  ...MOCK_REPOS_RESPONSE,
  repos: MOCK_REPOS_RESPONSE.repos.map(r =>
    r.status === 'missing'
      ? {
          ...r,
          links: {
            openRepo: r.htmlUrl,
            viewYaml: null,
            createYaml: `https://github.com/${r.org}/${r.name}/new/${r.branch}?filename=catalog-info.yaml`,
          },
        }
      : r,
  ),
};

/** Minimal catalog API mock — returns empty entity list for all queries. */
const mockCatalogApi = {
  getEntities: jest.fn().mockResolvedValue({ items: [] }),
};

const buildMockApi = (
  override?: Partial<CatalogCoverageApi>,
): CatalogCoverageApi => ({
  listRepos: async () => MOCK_REPOS_WITH_LINKS,
  getSuggestion: async (owner, repo) => ({
    owner,
    repo,
    yaml: `apiVersion: backstage.io/v1alpha1\nkind: Component\n`,
    signals: {},
  }),
  getSuggestionsBatch: async () => [],
  onboardRepo: jest.fn().mockResolvedValue({
    link: 'https://github.com/zentala/test/pull/1',
    location: '',
  }),
  refreshSuggestion: jest.fn().mockResolvedValue({
    owner: '',
    repo: '',
    yaml: '',
    signals: {},
  }),
  updateRepoMetadata: jest
    .fn()
    .mockResolvedValue({ description: null, topics: [] }),
  getConfig: jest.fn().mockReturnValue({
    allowDirectCommit: false,
    detectBranchProtection: true,
    defaultOwner: undefined,
  }),
  commitDirectRepo: jest.fn().mockResolvedValue({ link: '' }),
  ...override,
});

const renderWithApi = (api: CatalogCoverageApi) =>
  renderInTestApp(
    <TestApiProvider
      apis={[
        [catalogCoverageApiRef, api],
        [catalogApiRef, mockCatalogApi],
      ]}
    >
      <CatalogCoveragePage />
    </TestApiProvider>,
  );

describe('CatalogCoveragePage', () => {
  beforeEach(() => {
    mockCatalogApi.getEntities.mockClear();
  });

  it('renders the page header', async () => {
    await renderWithApi(buildMockApi());
    expect(await screen.findByText('GitHub Catalog Info')).toBeInTheDocument();
  });

  it('renders rows returned by the API', async () => {
    await renderWithApi(buildMockApi());
    // Source column renders "org/repo" format
    expect(await screen.findByText('zentala/backstage')).toBeInTheDocument();
    expect(screen.getByText('zentala/chrome-extension')).toBeInTheDocument();
  });

  it('renders org column data in the table', async () => {
    await renderWithApi(buildMockApi());
    // Organization is now a hidden column used by the table's built-in filter toolbar.
    // Verify the org/name values render correctly in the Location Source column.
    expect(await screen.findByText('zentala/backstage')).toBeInTheDocument();
  });

  it('shows a branch-mismatch hint when present on a row', async () => {
    await renderWithApi(buildMockApi());
    expect(await screen.findByText(/branch mismatch/i)).toBeInTheDocument();
  });

  it('shows coverage stats in the page header', async () => {
    await renderWithApi(buildMockApi());
    // Scope to the header banner — "Present"/"Missing"/"Invalid" also appear as
    // status chips in table rows, so bare getByText would find multiple elements.
    const banner = await screen.findByRole('banner');
    expect(within(banner).getByText('Coverage')).toBeInTheDocument();
    expect(within(banner).getByText('Present')).toBeInTheDocument();
    expect(within(banner).getByText('Missing')).toBeInTheDocument();
    expect(within(banner).getByText('Invalid')).toBeInTheDocument();
  });

  it('renders the sync action in the table toolbar', async () => {
    await renderWithApi(buildMockApi());
    expect(
      await screen.findByTitle('Re-check catalog-info.yaml status'),
    ).toBeInTheDocument();
  });

  describe('Create YAML button', () => {
    afterEach(() => jest.restoreAllMocks());

    it('opens a blank tab then navigates to GitHub editor pre-filled with suggestion', async () => {
      const win = { location: { href: '' } };
      jest.spyOn(window, 'open').mockReturnValue(win as unknown as Window);
      const user = userEvent.setup();
      await renderWithApi(buildMockApi());
      await screen.findByText('zentala/mdpad');
      await user.click(
        screen.getAllByLabelText(/pre-filled with AI suggestion/i)[0],
      );
      expect(window.open).toHaveBeenCalledWith('', '_blank');
      await waitFor(() => expect(win.location.href).toContain('&value='));
      expect(win.location.href).toContain('catalog-info.yaml');
    });

    it('navigates to fallback URL when getSuggestion fails', async () => {
      const win = { location: { href: '' } };
      jest.spyOn(window, 'open').mockReturnValue(win as unknown as Window);
      const user = userEvent.setup();
      await renderWithApi(
        buildMockApi({
          getSuggestion: jest.fn().mockRejectedValue(new Error('network')),
        }),
      );
      await screen.findByText('zentala/mdpad');
      await user.click(
        screen.getAllByLabelText(/pre-filled with AI suggestion/i)[0],
      );
      await waitFor(() =>
        expect(win.location.href).toContain('catalog-info.yaml'),
      );
      expect(win.location.href).not.toContain('&value=');
    });
  });

  it('shows PluginErrorPanel when listRepos fails with Failed to fetch', async () => {
    await renderWithApi(
      buildMockApi({
        listRepos: jest
          .fn()
          .mockRejectedValue(new TypeError('Failed to fetch')),
      }),
    );
    expect(
      await screen.findByText('Backend not available'),
    ).toBeInTheDocument();
  });

  it('shows PluginErrorPanel when listRepos fails with unexpected error', async () => {
    await renderWithApi(
      buildMockApi({
        listRepos: jest.fn().mockRejectedValue(new Error('connection refused')),
      }),
    );
    expect(await screen.findByText('Unexpected error')).toBeInTheDocument();
  });
});
