import { catalogCoveragePlugin } from './plugin';

describe('catalog-coverage', () => {
  it('should export plugin', () => {
    expect(catalogCoveragePlugin).toBeDefined();
  });
});
