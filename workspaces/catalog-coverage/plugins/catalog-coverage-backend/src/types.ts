/**
 * Public types for `catalog-coverage-backend`.
 *
 * `Repo` mirrors the shape consumed by the frontend table row in the
 * catalog-coverage plugin. One row = one `Location` entity in the
 * Backstage catalog.
 */

/**
 * Whether a repository has a `catalog-info.yaml`, and whether it parses.
 *
 * @public
 */
export type RepoStatus = 'present' | 'missing' | 'invalid';

/**
 * VCS provider kind derived from the Location target URL.
 *
 * @public
 */
export type ProviderKind = 'github' | 'gitlab' | 'unknown';

/**
 * Whether the repository owner account is a User or Organization.
 *
 * @public
 */
export type AccountType = 'User' | 'Organization' | 'Unknown';

/**
 * Taxonomy status assigned to a repo by the statusClassifier.
 *
 * @public
 */
export type TaxonomyStatusKind =
  | 'Discovered'
  | 'Issues'
  | 'Missing'
  | 'Waiting'
  | 'Excluded';

/**
 * A single reason a repo was classified as `Issues`.
 *
 * @public
 */
export type TaxonomyIssue = {
  kind: string;
  message: string;
  field?: string;
};

/**
 * Onboarding classification of a repo, with the issues behind it.
 *
 * @public
 */
export type TaxonomyStatus = {
  kind: TaxonomyStatusKind;
  issues?: Array<TaxonomyIssue>;
};

/**
 * Recorded when the catalog Location points at a branch that is not the
 * repository's default branch.
 *
 * @public
 */
export type BranchMismatch = {
  expectedBranch: string;
  actualDefaultBranch: string;
};

/**
 * Completeness score of one entity declared by a repo's `catalog-info.yaml`.
 *
 * @public
 */
export type ChildScore = {
  kind: string;
  name: string;
  ref: string;
  score: number;
  missing: Array<string>;
};

/**
 * Completeness across every entity a repo declares, plus the per-entity detail.
 *
 * @public
 */
export type CompletenessAggregate = {
  avg: number;
  min: number;
  children: Array<ChildScore>;
};

/**
 * Provider-generated action URLs for a catalog-info.yaml file.
 *
 * @public
 */
export type RepoLinks = {
  /** URL to view the existing `catalog-info.yaml` on the web, or `null` for unsupported hosts. */
  viewYaml: string | null;
  /** URL to create a new `catalog-info.yaml` via the host's file editor, or `null` for unsupported hosts. */
  createYaml: string | null;
  /** URL to the repository root page. */
  openRepo: string;
  /** URL to the open `backstage-integration` pull request. Present only when taxonomyStatus is Waiting. */
  prUrl?: string;
};

/**
 * One row of the coverage report: a repository discovered as a catalog
 * `Location`, its `catalog-info.yaml` status, and its VCS metadata.
 *
 * @public
 */
export type Repo = {
  name: string;
  org: string;
  host: string;
  branch: string;
  path: string;
  htmlUrl: string;
  locationRef: string;

  status: RepoStatus;
  branchMismatch?: BranchMismatch;

  childCount: number;
  completeness?: CompletenessAggregate;

  lastSeen: string;

  /** Provider-generated action links for this repo's catalog-info.yaml. */
  links?: RepoLinks;

  /** VCS provider derived from the Location target URL. */
  provider?: ProviderKind;

  /** Whether the repository owner is a User or Organization. */
  accountType?: AccountType;

  /** Taxonomy status for onboarding UX: Discovered / Issues / Missing / Excluded. */
  taxonomyStatus?: TaxonomyStatus;

  /** GitHub repo description (from REST API). Null when GitHub returns null. */
  description?: string | null;

  /** GitHub repository topics (tags). */
  topics?: Array<string>;

  /** Star count from GitHub. */
  stars?: number;

  /** ISO 8601 timestamp of the most recent push to the repository. */
  pushedAt?: string;

  /** Fork count from GitHub. */
  forks?: number;

  /** Default branch name (e.g. "main", "master") from GitHub. */
  defaultBranch?: string;

  /** Total commit count on the default branch, fetched from GitHub pagination. */
  commitCount?: number;

  /** Whether the GitHub repository is archived (read-only). */
  archived?: boolean;

  /** Repository visibility: public, private, or internal (org-wide on GitHub Enterprise). */
  visibility?: 'public' | 'private' | 'internal';
};

export type ProbeResult = {
  status: RepoStatus;
  branchMismatch?: BranchMismatch;
  cachedAt: number;
  /** Raw YAML content captured when status is 'invalid'. Internal use only — not serialized in Repo. */
  rawYaml?: string;
};

export type ScoreResult = {
  total: number;
  required: number;
  recommended: number;
  annotations: number;
  missing: Array<string>;
};
