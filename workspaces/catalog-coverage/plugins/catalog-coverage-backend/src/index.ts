/**
 * Public API of `catalog-coverage-backend`.
 *
 * The plugin itself is the product; everything a consumer can reach from here
 * is a compatibility commitment. The exported set is exactly `Repo` — the
 * response payload of the coverage endpoint — plus every type structurally
 * reachable from it: a consumer that reads `repo.links.prUrl` depends on
 * `RepoLinks` whether or not it names it, so it is named. `ProbeResult` and
 * `ScoreResult` are deliberately absent: they describe internal probing and
 * scoring steps and never appear on `Repo`.
 */
export { catalogCoverageBackendPlugin as default } from './plugin';
export type {
  AccountType,
  BranchMismatch,
  ChildScore,
  CompletenessAggregate,
  ProviderKind,
  Repo,
  RepoLinks,
  RepoStatus,
  TaxonomyIssue,
  TaxonomyStatus,
  TaxonomyStatusKind,
} from './types';
