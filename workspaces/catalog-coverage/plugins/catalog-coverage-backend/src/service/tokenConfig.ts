import { RootConfigService } from '@backstage/backend-plugin-api';

/**
 * Resolve the GitHub token and the onboarding owner allowlist from Backstage
 * config, with backward-compatible fallbacks.
 *
 * Token: prefers `catalogCoverage.token` (redacted by Backstage's config
 * machinery) and falls back to the legacy `GITHUB_TOKEN` env var.
 *
 * Allowlist: the union of `catalogCoverage.allowedOwners` and, for
 * back-compat, `catalogCoverage.defaultOwner.ref` if set. Used by the owner
 * guard on mutating routes (see authz.ts).
 */
export const resolveGithubToken = (
  config: RootConfigService,
): string | undefined =>
  config.getOptionalString('catalogCoverage.token') ?? process.env.GITHUB_TOKEN;

export const resolveAllowedOwners = (
  config: RootConfigService,
): Array<string> => {
  const explicit =
    config.getOptionalStringArray('catalogCoverage.allowedOwners') ?? [];
  const defaultRef = config.getOptionalString(
    'catalogCoverage.defaultOwner.ref',
  );
  const owners = new Set(explicit.map(o => o.trim()).filter(Boolean));
  if (defaultRef) owners.add(defaultRef.trim());
  return [...owners];
};
