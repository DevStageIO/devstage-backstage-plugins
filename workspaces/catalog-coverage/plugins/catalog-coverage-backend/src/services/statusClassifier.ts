/**
 * Status taxonomy classifier for GitHub catalog-info onboarding.
 *
 * Maps repo metadata to a 4-kind taxonomy:
 * - `Excluded` — archived or annotated with zentala.io/skip-discovery
 * - `Missing`  — no catalog-info.yaml found (linksCount === 0)
 * - `Issues`   — file exists but validators found problems
 * - `Discovered` — file exists and valid
 *
 * First match wins (Excluded before Missing before Issues before Discovered).
 */

export type StatusKind =
  | 'Discovered'
  | 'Issues'
  | 'Missing'
  | 'Waiting'
  | 'Excluded';

export type IssueItem = {
  kind: string;
  message: string;
  field?: string;
};

export type StatusResult = {
  kind: StatusKind;
  issues?: Array<IssueItem>;
};

/** Input shape for classifyStatus — derived from a Repo row. */
export type ClassifyInput = {
  archived: boolean;
  annotations?: Record<string, string>;
  linksCount: number;
  hasIssues: boolean;
  issues?: Array<IssueItem>;
};

const SKIP_ANNOTATION = 'zentala.io/skip-discovery';

/**
 * Classify a repo into one of 4 status kinds.
 * Logic order: Excluded → Missing → Issues → Discovered.
 */
export const classifyStatus = (input: ClassifyInput): StatusResult => {
  const { archived, annotations, linksCount, hasIssues, issues } = input;

  if (archived || annotations?.[SKIP_ANNOTATION] !== undefined) {
    return { kind: 'Excluded' };
  }

  if (linksCount === 0) {
    return { kind: 'Missing' };
  }

  if (hasIssues) {
    return { kind: 'Issues', issues: issues ?? [] };
  }

  return { kind: 'Discovered' };
};
