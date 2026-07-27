import { ConfigApi } from '@backstage/core-plugin-api';

/** Backstage config key for this plugin. */
const CONFIG_KEY = 'catalogCoverage';

/**
 * Supported owner kinds for defaultOwner.
 *
 * @public
 */
export type OwnerKind = 'user' | 'group';

/**
 * Default owner definition used when auto-generating catalog-info.yaml.
 *
 * @public
 */
export interface DefaultOwner {
  /** Whether the owner ref names a User or a Group entity. */
  kind: OwnerKind;
  /** Entity name, e.g. `platform-team` — not a full entity ref. */
  ref: string;
}

/**
 * Runtime configuration for the catalog-coverage plugin, read from the
 * `catalogCoverage` block of app-config.yaml.
 *
 * @public
 */
export interface CatalogCoverageConfig {
  /** Allow creating catalog-info.yaml via direct commit (skipping a PR). */
  allowDirectCommit: boolean;
  /**
   * When true, the plugin checks for branch protection on the target repo
   * and disables the direct-commit option if protection is active.
   */
  detectBranchProtection: boolean;
  /**
   * Default owner to pre-fill in the onboarding modal.
   * Omit to leave the owner field blank.
   */
  defaultOwner?: DefaultOwner;
}

export const DEFAULT_GITHUB_CATALOG_INFO_CONFIG: CatalogCoverageConfig = {
  allowDirectCommit: false,
  detectBranchProtection: true,
  defaultOwner: undefined,
};

const DEFAULTS = DEFAULT_GITHUB_CATALOG_INFO_CONFIG;

/** Read and validate plugin config from the Backstage ConfigApi. */
export function readCatalogCoverageConfig(
  config: ConfigApi,
): CatalogCoverageConfig {
  if (!config.has(CONFIG_KEY)) {
    return { ...DEFAULTS };
  }

  const root = config.getConfig(CONFIG_KEY);

  const allowDirectCommit = root.has('allowDirectCommit')
    ? root.getBoolean('allowDirectCommit')
    : DEFAULTS.allowDirectCommit;

  const detectBranchProtection = root.has('detectBranchProtection')
    ? root.getBoolean('detectBranchProtection')
    : DEFAULTS.detectBranchProtection;

  let defaultOwner: DefaultOwner | undefined;
  if (root.has('defaultOwner')) {
    const ownerConfig = root.getConfig('defaultOwner');
    const kind = ownerConfig.getString('kind') as OwnerKind;
    const ref = ownerConfig.getString('ref');
    if (kind !== 'user' && kind !== 'group') {
      // eslint-disable-next-line no-console
      console.warn(
        `[catalog-coverage] Unknown defaultOwner.kind "${kind}", expected "user" or "group". Ignoring.`,
      );
    } else {
      defaultOwner = { kind, ref };
    }
  }

  const knownKeys = new Set([
    'allowDirectCommit',
    'detectBranchProtection',
    'defaultOwner',
    // Backend-only keys that share the catalogCoverage.* namespace.
    'token',
    'allowedOwners',
  ]);
  for (const key of root.keys()) {
    if (!knownKeys.has(key)) {
      // eslint-disable-next-line no-console
      console.warn(
        `[catalog-coverage] Unknown config key "${CONFIG_KEY}.${key}" — ignoring.`,
      );
    }
  }

  return { allowDirectCommit, detectBranchProtection, defaultOwner };
}
