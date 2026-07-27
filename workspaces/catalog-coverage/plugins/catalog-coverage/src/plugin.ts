import {
  configApiRef,
  createApiFactory,
  createPlugin,
  createRoutableExtension,
  discoveryApiRef,
  fetchApiRef,
} from '@backstage/core-plugin-api';

import {
  CatalogCoverageClient,
  catalogCoverageApiRef,
} from './api/CatalogCoverageApi';
import { readCatalogCoverageConfig } from './config';
import { rootRouteRef } from './routes';

/**
 * The catalog-coverage frontend plugin. Registers the coverage API and the
 * `root` route the page mounts on.
 *
 * @public
 */
export const catalogCoveragePlugin = createPlugin({
  id: 'catalog-coverage',
  apis: [
    createApiFactory({
      api: catalogCoverageApiRef,
      deps: {
        discoveryApi: discoveryApiRef,
        fetchApi: fetchApiRef,
        configApi: configApiRef,
      },
      factory: ({ discoveryApi, fetchApi, configApi }) =>
        new CatalogCoverageClient({
          discoveryApi,
          fetchApi,
          config: readCatalogCoverageConfig(configApi),
        }),
    }),
  ],
  routes: {
    root: rootRouteRef,
  },
});

/**
 * Routable extension rendering the coverage dashboard. Mount it in the app's
 * `<FlatRoutes>` at whatever path you prefer.
 *
 * @public
 */
export const CatalogCoveragePage = catalogCoveragePlugin.provide(
  createRoutableExtension({
    name: 'CatalogCoveragePage',
    component: () =>
      import('./components/CatalogCoveragePage').then(
        m => m.CatalogCoveragePage,
      ),
    mountPoint: rootRouteRef,
  }),
);
