import { ConfigReader } from '@backstage/config';
import type { JsonObject } from '@backstage/types';
import {
  readCatalogCoverageConfig,
  CatalogCoverageConfig,
} from './CatalogCoverageConfig';

function makeConfig(raw: JsonObject) {
  return new ConfigReader(raw);
}

describe('readCatalogCoverageConfig', () => {
  it('returns defaults when section is absent', () => {
    const config = makeConfig({});
    const result = readCatalogCoverageConfig(config);
    expect(result).toEqual<CatalogCoverageConfig>({
      allowDirectCommit: false,
      detectBranchProtection: true,
      defaultOwner: undefined,
    });
  });

  it('returns defaults when section is empty', () => {
    const config = makeConfig({ catalogCoverage: {} });
    const result = readCatalogCoverageConfig(config);
    expect(result).toEqual<CatalogCoverageConfig>({
      allowDirectCommit: false,
      detectBranchProtection: true,
      defaultOwner: undefined,
    });
  });

  describe('allowDirectCommit', () => {
    it('is false by default', () => {
      const config = makeConfig({ catalogCoverage: {} });
      expect(readCatalogCoverageConfig(config).allowDirectCommit).toBe(false);
    });

    it('reads true when set', () => {
      const config = makeConfig({
        catalogCoverage: { allowDirectCommit: true },
      });
      expect(readCatalogCoverageConfig(config).allowDirectCommit).toBe(true);
    });

    it('reads false when explicitly set', () => {
      const config = makeConfig({
        catalogCoverage: { allowDirectCommit: false },
      });
      expect(readCatalogCoverageConfig(config).allowDirectCommit).toBe(false);
    });
  });

  describe('detectBranchProtection', () => {
    it('is true by default', () => {
      const config = makeConfig({ catalogCoverage: {} });
      expect(readCatalogCoverageConfig(config).detectBranchProtection).toBe(
        true,
      );
    });

    it('reads false when set', () => {
      const config = makeConfig({
        catalogCoverage: { detectBranchProtection: false },
      });
      expect(readCatalogCoverageConfig(config).detectBranchProtection).toBe(
        false,
      );
    });

    it('reads true when explicitly set', () => {
      const config = makeConfig({
        catalogCoverage: { detectBranchProtection: true },
      });
      expect(readCatalogCoverageConfig(config).detectBranchProtection).toBe(
        true,
      );
    });
  });

  describe('defaultOwner', () => {
    it('is undefined by default', () => {
      const config = makeConfig({ catalogCoverage: {} });
      expect(readCatalogCoverageConfig(config).defaultOwner).toBeUndefined();
    });

    it('reads user kind', () => {
      const config = makeConfig({
        catalogCoverage: {
          defaultOwner: { kind: 'user', ref: 'zentala' },
        },
      });
      expect(readCatalogCoverageConfig(config).defaultOwner).toEqual({
        kind: 'user',
        ref: 'zentala',
      });
    });

    it('reads group kind', () => {
      const config = makeConfig({
        catalogCoverage: {
          defaultOwner: { kind: 'group', ref: 'platform-team' },
        },
      });
      expect(readCatalogCoverageConfig(config).defaultOwner).toEqual({
        kind: 'group',
        ref: 'platform-team',
      });
    });

    it('ignores unknown kind and warns', () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      const config = makeConfig({
        catalogCoverage: {
          defaultOwner: { kind: 'unknown', ref: 'foo' },
        },
      });
      const result = readCatalogCoverageConfig(config);
      expect(result.defaultOwner).toBeUndefined();
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Unknown defaultOwner.kind'),
      );
      warnSpy.mockRestore();
    });
  });

  it('warns on unknown top-level keys', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const config = makeConfig({
      catalogCoverage: { unknownKey: 'value' },
    });
    readCatalogCoverageConfig(config);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        'Unknown config key "catalogCoverage.unknownKey"',
      ),
    );
    warnSpy.mockRestore();
  });
});
