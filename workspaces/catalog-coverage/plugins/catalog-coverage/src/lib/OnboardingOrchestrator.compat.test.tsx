/**
 * Compat test: verifies that catalogImportApiRef uses the official ID and that
 * the real CatalogImportApi from @backstage/plugin-catalog-import satisfies our
 * local minimal CatalogImportApi interface (structural superset check).
 *
 * If this file compiles without TypeScript errors, the real API is compatible
 * with the interface that OnboardingOrchestrator requires.
 */
import { catalogImportApiRef as realRef } from '@backstage/plugin-catalog-import';
import type { CatalogImportApi as RealCatalogImportApi } from '@backstage/plugin-catalog-import';
import type { CatalogImportApi as LocalCatalogImportApi } from './OnboardingOrchestrator';

describe('CatalogImportApi compat', () => {
  it('real apiRef has the correct id', () => {
    expect(realRef.id).toBe('plugin.catalog-import.service');
  });

  it('real interface satisfies the local minimal subset (compile-time check)', () => {
    // The real CatalogImportApi is a structural superset of our local interface
    // (it also has analyzeUrl, preparePullRequest). TypeScript requires that the
    // superset is assignable to the subset — this verifies that our minimal
    // interface correctly captures the submitPullRequest contract.
    // If this compiles, the real API can always be passed where LocalCatalogImportApi is expected.
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const check: LocalCatalogImportApi = {} as RealCatalogImportApi;
    expect(check).toBeDefined();
  });
});
