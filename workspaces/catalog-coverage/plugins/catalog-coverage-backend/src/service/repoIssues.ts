/**
 * Derivation of a repository's coverage issues and taxonomy status.
 *
 * Split out of `repoBuilder.ts` so the enrichment path there reads as a
 * sequence of steps rather than inline derivation logic. Pure — no I/O, no
 * dependencies beyond a schema validator — which is also what makes it
 * directly unit-testable.
 */

import { ProviderKind, Repo } from '../types';
import { findProvider } from '../services/locationProvider';
import {
  classifyStatus,
  IssueItem,
  StatusResult,
} from '../services/statusClassifier';
import { SchemaValidator } from '../services/SchemaValidator';

/** Derive provider kind from a URL string. */
export const getProviderKind = (url: string): ProviderKind => {
  if (!url) return 'unknown';
  const provider = findProvider(url);
  if (!provider) return 'unknown';
  try {
    const { hostname } = new URL(url);
    if (hostname === 'github.com') return 'github';
    if (hostname === 'gitlab.com' || hostname.startsWith('gitlab.'))
      return 'gitlab';
  } catch {
    // fall through
  }
  return 'unknown';
};

/**
 * Collects a repo's issues and classifies its taxonomy status.
 *
 * Schema errors are only derived when the probe actually returned YAML — an
 * `invalid` status with no body means the fetch failed, not that the document
 * is malformed, and reporting schema errors there would be a guess.
 */
export const deriveRepoIssues = (
  repo: Repo,
  rawYaml: string | undefined,
  validator: SchemaValidator,
): { issues: Array<IssueItem>; taxonomyStatus: StatusResult } => {
  const linksCount = repo.links?.viewYaml || repo.childCount > 0 ? 1 : 0;
  const hasIssues = repo.status === 'invalid' || !!repo.branchMismatch;

  const schemaIssues: Array<IssueItem> =
    repo.status === 'invalid' && rawYaml
      ? validator.validate(rawYaml).errors.map(e => ({
          kind: 'schema-error',
          message: e.message,
          field: e.path || undefined,
        }))
      : [];

  const issues: Array<IssueItem> = [
    ...(repo.branchMismatch
      ? [
          {
            kind: 'branch-mismatch',
            message: `Expected branch '${repo.branchMismatch.expectedBranch}', got '${repo.branchMismatch.actualDefaultBranch}'`,
            field: 'branch',
          },
        ]
      : []),
    ...schemaIssues,
  ];

  return {
    issues,
    taxonomyStatus: classifyStatus({
      archived: repo.archived ?? false,
      annotations: undefined,
      linksCount,
      hasIssues,
      issues,
    }),
  };
};
