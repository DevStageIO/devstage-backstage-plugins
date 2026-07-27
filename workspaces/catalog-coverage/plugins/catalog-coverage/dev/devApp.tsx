import { createDevApp } from '@backstage/dev-utils';
import { discoveryApiRef, fetchApiRef } from '@backstage/core-plugin-api';
import { catalogApiRef } from '@backstage/plugin-catalog-react';
import { CatalogClient } from '@backstage/catalog-client';
import { catalogCoveragePlugin, CatalogCoveragePage } from '../src/plugin';
import {
  CatalogCoverageApi,
  catalogCoverageApiRef,
} from '../src/api/CatalogCoverageApi';
import { MOCK_REPOS_RESPONSE } from '../src/data/mockRepos';
import { ReposResponse } from '../src/data/types';

/**
 * Set to run the page against fixtures instead of the dev backend — useful
 * offline, or when working on the table itself. The default is the real
 * client, because a harness that never calls the backend cannot catch a
 * contract break between the two packages.
 */
const USE_MOCK_API = process.env.CATALOG_COVERAGE_DEV_MOCK === 'true';

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

/**
 * Assemble the dev app without rendering it, so the smoke test can prove the
 * harness still wires up after a dependency or extension change.
 */
export const buildDevApp = () => {
  const app = createDevApp().registerPlugin(catalogCoveragePlugin);

  // `createDevApp` ships no catalog API, but the coverage table enriches its
  // rows from the catalog (`useEntitiesBySlug`) — without this the page dies on
  // `No implementation available for apiRef{plugin.catalog.service}`. A real
  // portal already provides it, so it stays a dev-only registration.
  app.registerApi({
    api: catalogApiRef,
    deps: { discoveryApi: discoveryApiRef, fetchApi: fetchApiRef },
    factory: ({ discoveryApi, fetchApi }) =>
      new CatalogClient({ discoveryApi, fetchApi }),
  });

  if (USE_MOCK_API) {
    app.registerApi({
      api: catalogCoverageApiRef,
      deps: {},
      factory: () => mockApi,
    });
  }

  return app.addPage({
    element: <CatalogCoveragePage />,
    title: 'Catalog coverage',
    path: '/catalog-coverage',
  });
};
