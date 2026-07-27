import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TestApiProvider, renderInTestApp } from '@backstage/test-utils';
import { catalogCoverageApiRef } from '../api/CatalogCoverageApi';
import type {
  CatalogCoverageApi,
  SuggestionResponse,
} from '../api/CatalogCoverageApi';
import { OnboardModal } from './OnboardModal';

const SUGGESTION: SuggestionResponse = {
  owner: 'zentala',
  repo: 'my-repo',
  yaml: 'apiVersion: backstage.io/v1alpha1\nkind: Component\nmetadata:\n  name: my-repo\nspec:\n  type: service\n  lifecycle: experimental\n  owner: zentala\n',
  signals: {},
};

const buildGithubCatalogInfoApi = (
  override?: Partial<CatalogCoverageApi>,
): CatalogCoverageApi => ({
  listRepos: jest.fn().mockResolvedValue({ repos: [], summary: {} }),
  getSuggestion: jest.fn().mockResolvedValue(SUGGESTION),
  getSuggestionsBatch: jest.fn().mockResolvedValue([SUGGESTION]),
  onboardRepo: jest.fn().mockResolvedValue({
    link: 'https://github.com/zentala/my-repo/pull/1',
    location: '',
  }),
  refreshSuggestion: jest.fn().mockResolvedValue(SUGGESTION),
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

interface RenderOptions {
  githubApi?: Partial<CatalogCoverageApi>;
  open?: boolean;
  onClose?: () => void;
  onSuccess?: (url: string) => void;
}

const renderModal = ({
  githubApi,
  open = true,
  onClose = jest.fn(),
  onSuccess = jest.fn(),
}: RenderOptions = {}) => {
  const resolvedGithubApi = buildGithubCatalogInfoApi(githubApi);

  return renderInTestApp(
    <TestApiProvider apis={[[catalogCoverageApiRef, resolvedGithubApi]]}>
      <OnboardModal
        open={open}
        owner="zentala"
        repo="my-repo"
        onClose={onClose}
        onSuccess={onSuccess}
      />
    </TestApiProvider>,
  );
};

describe('OnboardModal', () => {
  it('renders dialog title with owner/repo', async () => {
    await renderModal();
    expect(
      await screen.findByText('Onboard: zentala/my-repo'),
    ).toBeInTheDocument();
  });

  it('renders YAML from getSuggestion in the editor', async () => {
    await renderModal();
    const textarea = await screen.findByRole('textbox', {
      name: /catalog-info\.yaml/i,
    });
    expect(textarea).toHaveValue(SUGGESTION.yaml);
  });

  it('"Open PR" button is disabled when yaml is empty', async () => {
    await renderModal({
      githubApi: {
        getSuggestion: jest.fn().mockResolvedValue({ ...SUGGESTION, yaml: '' }),
      },
    });
    await waitFor(() => {
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    });
    const openPrButton = screen.getByRole('button', { name: /open pr/i });
    expect(openPrButton).toBeDisabled();
  });

  it('"Open PR" button is disabled when yaml does not start with apiVersion:', async () => {
    await renderModal({
      githubApi: {
        getSuggestion: jest
          .fn()
          .mockResolvedValue({ ...SUGGESTION, yaml: 'invalid yaml' }),
      },
    });
    await waitFor(() => {
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    });
    const openPrButton = screen.getByRole('button', { name: /open pr/i });
    expect(openPrButton).toBeDisabled();
  });

  it('"Open PR" button is enabled for valid yaml', async () => {
    await renderModal();
    const openPrButton = await screen.findByRole('button', {
      name: /open pr/i,
    });
    expect(openPrButton).not.toBeDisabled();
  });

  it('shows error message on failed-perm result', async () => {
    const permErr = Object.assign(new Error('Not found'), { statusCode: 403 });
    await renderModal({
      githubApi: {
        onboardRepo: jest.fn().mockRejectedValue(permErr),
      },
    });

    const openPrButton = await screen.findByRole('button', {
      name: /open pr/i,
    });
    await userEvent.click(openPrButton);

    expect(await screen.findByText(/permission error/i)).toBeInTheDocument();
  });

  it('shows error message when PR already exists (skipped)', async () => {
    const conflictErr = Object.assign(new Error('Conflict'), {
      statusCode: 422,
    });
    await renderModal({
      githubApi: {
        onboardRepo: jest.fn().mockRejectedValue(conflictErr),
      },
    });

    const openPrButton = await screen.findByRole('button', {
      name: /open pr/i,
    });
    await userEvent.click(openPrButton);

    expect(await screen.findByText(/a pr already exists/i)).toBeInTheDocument();
  });

  it('calls onSuccess with PR URL on success', async () => {
    const onSuccess = jest.fn();
    await renderModal({ onSuccess });

    const openPrButton = await screen.findByRole('button', {
      name: /open pr/i,
    });
    await userEvent.click(openPrButton);

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledWith(
        'https://github.com/zentala/my-repo/pull/1',
      );
    });
  });

  it('shows loading spinner while fetching suggestion', async () => {
    let resolvePromise!: (value: SuggestionResponse) => void;
    const slowPromise = new Promise<SuggestionResponse>(res => {
      resolvePromise = res;
    });

    await renderModal({
      githubApi: {
        getSuggestion: jest.fn().mockReturnValue(slowPromise),
      },
    });

    expect(document.querySelector('[role="progressbar"]')).toBeInTheDocument();

    resolvePromise(SUGGESTION);
    await waitFor(() => {
      expect(
        document.querySelector('[role="progressbar"]'),
      ).not.toBeInTheDocument();
    });
  });
});
