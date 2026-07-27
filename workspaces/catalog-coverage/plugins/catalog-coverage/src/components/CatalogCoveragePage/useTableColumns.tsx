/**
 * useTableColumns — column definitions for the GitHub Catalog Info coverage table.
 *
 * Extracted to keep CatalogCoveragePage under the 250-line limit.
 * Rich cells are in LocationSourceCell.tsx and EnrichedStatusCell.tsx.
 */
import { Checkbox } from '@material-ui/core';
import { TableColumn } from '@backstage/core-components';
import { CatalogEntity, CatalogInfoStatus, Repo } from '../../data/types';
import { ActionsCell, StatusKind } from '../ActionsCell';
import { isMissingStatus } from './useBulkOrchestrator';
import { LocationSourceCell } from './LocationSourceCell';
import { EnrichedStatusCell } from './EnrichedStatusCell';

const EMPTY_ENTITIES: Array<CatalogEntity> = [];

export type TableClasses = {
  badgePresent: string;
  badgeMissing: string;
  badgeInvalid: string;
  branchHint: string;
};

/**
 * Sort weight for the Catalog Info Status column.
 * Ascending order: present (0) → invalid (1) → missing (2).
 */
export const STATUS_SORT_WEIGHT: Record<CatalogInfoStatus, number> = {
  present: 0,
  invalid: 1,
  missing: 2,
};

/** Comparator for the Catalog Info Status column — present → invalid → missing (asc). */
export const compareByStatus = (a: Repo, b: Repo): number =>
  STATUS_SORT_WEIGHT[a.status] - STATUS_SORT_WEIGHT[b.status];

/** Maps backend CatalogInfoStatus to ActionsCell StatusKind taxonomy. */
export const mapStatus = (row: Repo): StatusKind => {
  if (row.status === 'present') return 'Discovered';
  if (row.status === 'invalid') return 'Issues';
  if (row.taxonomyStatus?.kind === 'Waiting') return 'Waiting';
  return 'Missing';
};

/**
 * Returns the column definitions for the coverage table.
 *
 * @param classes - MUI makeStyles classes from the page component.
 * @param onOnboard - Called when user clicks the "Onboard via PR" button for a row.
 * @param selectedRepoKeys - Set of currently selected repo keys ("org/name").
 * @param onToggleSelect - Called when a row checkbox is toggled.
 * @param onCreateYaml - Called when user clicks "Create catalog-info.yaml" for a row (Missing only).
 * @param onEditMetadata - Called when user clicks "Edit repository metadata".
 * @param allowDirectCommit - When true, shows the "Commit directly" button in ActionsCell.
 * @param onCommitDirect - Called when user clicks "Commit directly" for a row (owner, repo, branch).
 * @param committingRepos - Set of "org/name" keys currently being committed (disables FlashOn button).
 * @param entitiesBySlug - Map of "org/name" -> catalog entities, batched once at the page level (E015-T03).
 */
export const buildTableColumns = (
  classes: TableClasses,
  onOnboard: (owner: string, repo: string) => void,
  selectedRepoKeys?: Set<string>,
  onToggleSelect?: (key: string) => void,
  onCreateYaml?: (repo: Repo) => void,
  onEditMetadata?: (repo: Repo) => void,
  allowDirectCommit?: boolean,
  onCommitDirect?: (owner: string, repo: string, branch: string) => void,
  committingRepos?: Set<string>,
  entitiesBySlug?: Map<string, Array<CatalogEntity>>,
): Array<TableColumn<Repo>> => [
  {
    title: 'Organization',
    field: 'org',
    hidden: true,
  },
  {
    title: '',
    field: 'org',
    width: '36px',
    sorting: false,
    render: (row: Repo) => {
      const key = `${row.org}/${row.name}`;
      const checked = selectedRepoKeys?.has(key) ?? false;
      const disabled = !isMissingStatus(row);
      return (
        <Checkbox
          size="small"
          checked={checked}
          disabled={disabled}
          onChange={() => onToggleSelect?.(key)}
          inputProps={{ 'aria-label': `Select ${key}` }}
        />
      );
    },
  },
  {
    title: 'Location Source',
    field: 'name',
    sorting: false,
    render: (row: Repo) => <LocationSourceCell row={row} />,
  },
  {
    title: 'Catalog Info Status',
    field: 'status',
    cellStyle: { minWidth: 450 },
    headerStyle: { minWidth: 450 },
    customSort: compareByStatus,
    render: (row: Repo) => (
      <EnrichedStatusCell
        row={row}
        classes={classes}
        entities={
          entitiesBySlug?.get(`${row.org}/${row.name}`) ?? EMPTY_ENTITIES
        }
      />
    ),
  },
  {
    title: 'Actions',
    field: 'htmlUrl',
    width: '1%',
    cellStyle: {
      whiteSpace: 'nowrap' as const,
      paddingLeft: 4,
      paddingRight: 16,
    },
    headerStyle: {
      whiteSpace: 'nowrap' as const,
      paddingLeft: 4,
      paddingRight: 16,
    },
    render: (row: Repo) => (
      <ActionsCell
        links={{
          openRepo: row.links?.openRepo ?? row.htmlUrl,
          viewYaml: row.links?.viewYaml ?? null,
          createYaml: row.links?.createYaml ?? null,
        }}
        status={{ kind: mapStatus(row) }}
        prUrl={row.links?.prUrl}
        onOnboard={() => onOnboard(row.org, row.name)}
        onCreateYaml={() => onCreateYaml?.(row)}
        onEditMetadata={() => onEditMetadata?.(row)}
        allowDirectCommit={allowDirectCommit}
        onCommitDirect={() =>
          onCommitDirect?.(row.org, row.name, row.defaultBranch ?? row.branch)
        }
        branchProtected={row.branchProtected}
        isCommittingDirect={committingRepos?.has(`${row.org}/${row.name}`)}
      />
    ),
  },
];
