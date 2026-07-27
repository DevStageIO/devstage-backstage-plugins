/**
 * Status of a Location's catalog-info.yaml against the Backstage catalog.
 *
 * - `present` — at least one child entity is registered against this Location.
 * - `missing` — Location target was 404 (or the catalog produced no children).
 * - `invalid` — file exists but did not yield any catalog entities.
 *
 * @public
 */
export type CatalogInfoStatus = 'present' | 'missing' | 'invalid';

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
 * One validation issue from the backend taxonomy classifier or YAML schema
 * validator.
 *
 * @public
 */
export type TaxonomyIssue = {
  kind: string;
  message: string;
  field?: string;
};

/**
 * Onboarding taxonomy status sent by the backend enrichment pipeline.
 *
 * @public
 */
export type TaxonomyStatus = {
  kind: 'Discovered' | 'Issues' | 'Missing' | 'Waiting' | 'Excluded';
  issues?: Array<TaxonomyIssue>;
};

/**
 * One row in the coverage table = one Backstage `Location` entity.
 *
 * Mirrors the backend `Repo` type from the catalog-coverage-backend
 * plugin so that the page can render the response unchanged.
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

  status: CatalogInfoStatus;
  branchMismatch?: BranchMismatch;

  childCount: number;
  completeness?: CompletenessAggregate;

  lastSeen: string;

  /** GitHub repo description. Null when GitHub returns null; undefined when not yet fetched. */
  description?: string | null;

  /** Star count from GitHub. */
  stars?: number;

  /** ISO 8601 timestamp of the most recent push to the repository. */
  pushedAt?: string;

  /** Total commit count on the default branch. */
  commitCount?: number;

  /** Fork count from GitHub. */
  forks?: number;

  /** Default branch name (e.g. "main", "master"). */
  defaultBranch?: string;

  /**
   * Whether the repository is archived on GitHub.
   * Backend populates this from T08; frontend uses it to show the ARCHIVED chip.
   */
  archived?: boolean;

  /**
   * Repository visibility: public, private, or internal (org-wide on GitHub Enterprise).
   * Undefined for older cached responses.
   */
  visibility?: 'public' | 'private' | 'internal';

  /** GitHub repository topics (tags). Empty array when none. */
  topics?: Array<string>;

  /**
   * Pre-computed action links returned by the backend.
   * Present when the backend populates them; undefined otherwise (older API versions).
   */
  links?: {
    openRepo: string;
    viewYaml: string | null;
    createYaml: string | null;
    /** URL to the open `backstage-integration` pull request. Present only when taxonomyStatus is Waiting. */
    prUrl?: string;
  };

  /**
   * Onboarding taxonomy status with validation issues.
   * Populated by the backend enrichment pipeline; present for all repos.
   * For `status: 'invalid'` repos, `issues` contains schema validation errors.
   */
  taxonomyStatus?: TaxonomyStatus;

  /**
   * Whether the default branch has branch protection enabled.
   * Populated by the backend when `detectBranchProtection` is active.
   * Undefined means the check was not performed.
   */
  branchProtected?: boolean;
};

/**
 * Minimal catalog entity shape used to enrich a coverage row with the
 * Backstage entities discovered from its Location (`present`/`invalid` rows).
 */
export type CatalogEntity = {
  kind: string;
  metadata: { name: string; namespace?: string };
};

/**
 * Row counts per `CatalogInfoStatus` across the whole coverage report.
 *
 * @public
 */
export type RepoSummary = {
  total: number;
  present: number;
  missing: number;
  invalid: number;
};

/**
 * Payload of the coverage endpoint: every row plus its aggregate counts.
 *
 * @public
 */
export type ReposResponse = {
  repos: Array<Repo>;
  summary: RepoSummary;
};

/**
 * GitHub organization grouping repositories. Derived from the projection
 * (one entry per distinct `org`); kept as a type so the dev fixture can
 * still seed an explicit list.
 *
 * @public
 */
export type Org = {
  login: string;
  displayName: string;
  htmlUrl: string;
};

/**
 * One Backstage catalog entity (Component, API, Resource, …) registered
 * under a Location. Used to populate the inline-expanded child rows in the
 * coverage table.
 */
export type ChildEntity = {
  /** Fully-qualified entity ref, e.g. `component:default/my-service`. */
  entityRef: string;
  /** Backstage entity kind: Component, API, Resource, … */
  kind: string;
  /** Entity spec type, e.g. `service`, `website`, `library`. */
  type: string;
  /** Human-readable entity name (metadata.name). */
  name: string;
  /** Optional completeness score (0–100). */
  score?: number;
  /** URL to the source catalog-info.yaml on GitHub. */
  sourceUrl?: string;
};

/** Props for the InlineExpandRow component. */
export type InlineExpandRowProps = {
  /** Stable key used as the sessionStorage map key for this row's expanded state. */
  repoKey: string;
  /** Child entities to show when the row is expanded. */
  children: Array<ChildEntity>;
  /** The main table row content (rendered as-is in the collapsed state). */
  rowContent: React.ReactNode;
  /** Column count of the parent table — sets `colSpan` on the expand area. */
  colSpan: number;
};
