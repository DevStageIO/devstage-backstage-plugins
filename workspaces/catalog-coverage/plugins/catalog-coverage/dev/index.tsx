import { createDevApp } from '@backstage/dev-utils';
import { catalogCoveragePlugin, CatalogCoveragePage } from '../src/plugin';
import {
  CatalogCoverageApi,
  catalogCoverageApiRef,
} from '../src/api/CatalogCoverageApi';
import { MOCK_REPOS_RESPONSE } from '../src/data/mockRepos';
import { ReposResponse } from '../src/data/types';

const mockApi: CatalogCoverageApi = {
  listRepos: async (): Promise<ReposResponse> => MOCK_REPOS_RESPONSE,
  getSuggestion: async (owner: string, repo: string) => ({
    owner,
    repo,
    yaml: `apiVersion: backstage.io/v1alpha1\nkind: Component\nmetadata:\n  name: ${repo}\nspec:\n  type: service\n  lifecycle: experimental\n  owner: ${owner}\n`,
    signals: {},
  }),
  getSuggestionsBatch: async () => [],
  onboardRepo: async (_owner, _repo) => ({
    link: 'https://github.com/mock/pull/1',
    location: '',
  }),
  refreshSuggestion: async (owner: string, repo: string) => ({
    owner,
    repo,
    yaml: `apiVersion: backstage.io/v1alpha1\nkind: Component\nmetadata:\n  name: ${repo}\nspec:\n  type: service\n  lifecycle: experimental\n  owner: ${owner}\n`,
    signals: {},
  }),
  updateRepoMetadata: async () => ({ description: null, topics: [] }),
  getConfig: () => ({
    allowDirectCommit: false,
    detectBranchProtection: true,
    defaultOwner: undefined,
  }),
  commitDirectRepo: async () => ({ link: '' }),
};

createDevApp()
  .registerPlugin(catalogCoveragePlugin)
  .registerApi({
    api: catalogCoverageApiRef,
    deps: {},
    factory: () => mockApi,
  })
  .addPage({
    element: <CatalogCoveragePage />,
    title: 'Root Page',
    path: '/catalog-coverage',
  })
  .render();
