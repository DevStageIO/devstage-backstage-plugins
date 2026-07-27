/**
 * catalogImportApiRef — re-exported from the official @backstage/plugin-catalog-import
 * so this plugin resolves to the same singleton ApiRef instance that the catalog-import
 * plugin registers. Using a locally-created ref with the same ID would cause a duplicate
 * registration error in the Backstage ApiProvider.
 */
export { catalogImportApiRef } from '@backstage/plugin-catalog-import';
export type { CatalogImportApi } from '@backstage/plugin-catalog-import';
