/**
 * ActionsCell — per-row action buttons for the GitHub Catalog Info coverage table.
 *
 * Renders icon buttons depending on the repo's status kind:
 * - Open repo (always)
 * - Edit PR (Waiting only)
 * - View YAML (Discovered | Issues only)
 * - Create YAML on GitHub (Missing + createYaml link present)
 * - Onboard via PR (Missing only)
 * - Commit directly (Missing only, when allowDirectCommit is true)
 */
import { IconButton, Tooltip } from '@material-ui/core';
import OpenInNewIcon from '@material-ui/icons/OpenInNew';
import DescriptionIcon from '@material-ui/icons/Description';
import AddCircleOutlineIcon from '@material-ui/icons/AddCircleOutline';
import CloudUploadIcon from '@material-ui/icons/CloudUpload';
import FlashOnIcon from '@material-ui/icons/FlashOn';
import CreateIcon from '@material-ui/icons/Create';

/** Status kind for a repository entry in the coverage table. */
export type StatusKind =
  | 'Discovered'
  | 'Issues'
  | 'Missing'
  | 'Waiting'
  | 'Excluded';

export interface ActionsCellLinks {
  /** URL to the repository on GitHub/GitLab. Always present. */
  openRepo: string;
  /** URL to view the existing catalog-info.yaml. Null when not applicable. */
  viewYaml: string | null;
  /** GitHub "create file" deep-link prefilled to catalog-info.yaml. Null for unsupported providers. */
  createYaml: string | null;
}

export interface ActionsCellProps {
  links: ActionsCellLinks;
  status: { kind: StatusKind };
  /** URL of the open `backstage-integration` pull request. Present when status is Waiting. */
  prUrl?: string;
  /** Called when the user clicks "Onboard via PR". */
  onOnboard: () => void;
  /** Called when user clicks "Create catalog-info.yaml". Fetches suggestion and opens GitHub editor pre-filled. */
  onCreateYaml: () => void;
  /** Called when user clicks "Edit repository metadata" (description + topics). */
  onEditMetadata: () => void;
  /** When true, shows the "Commit directly" icon button alongside "Open PR". */
  allowDirectCommit?: boolean;
  /** Called when user clicks "Commit directly". Only relevant when allowDirectCommit is true. */
  onCommitDirect?: () => void;
  /**
   * When true and allowDirectCommit is true, the "Commit directly" button is disabled.
   * Indicates the repo's default branch has branch protection active.
   */
  branchProtected?: boolean;
  /** When true, the "Commit directly" button is disabled and shows a loading tooltip. */
  isCommittingDirect?: boolean;
}

const TOOLTIP_UNSUPPORTED = 'Provider not yet supported';
const TOOLTIP_GITLAB = 'GitLab support coming in Phase 4';

const TOOLTIP_VIEW_YAML = 'View catalog-info.yaml';
const TOOLTIP_OPEN_REPO = 'Open repository';
const TOOLTIP_CREATE_YAML =
  'Create catalog-info.yaml on GitHub (pre-filled with AI suggestion)';
const TOOLTIP_ONBOARD =
  'Let Backstage generate catalog-info.yaml and open a PR automatically';
const TOOLTIP_COMMIT_DIRECT =
  'Commit catalog-info.yaml directly to the default branch (no PR)';
const TOOLTIP_BRANCH_PROTECTED =
  'Branch protection active — direct commit disabled';
const TOOLTIP_COMMITTING = 'Committing to default branch…';
const TOOLTIP_EDIT_METADATA = 'Edit repository metadata (description & topics)';
const TOOLTIP_EDIT_PR = 'View pull request on GitHub';

/** Returns the disabled tooltip for a null link, GitLab-aware. */
const disabledTooltip = (url: string): string =>
  url.includes('gitlab') ? TOOLTIP_GITLAB : TOOLTIP_UNSUPPORTED;

/**
 * Per-row action column with icon buttons: Open repo, View YAML,
 * Create YAML deep-link, Onboard via PR, and optionally Commit directly.
 */
export const ActionsCell = ({
  links,
  status,
  prUrl,
  onOnboard,
  onCreateYaml,
  onEditMetadata,
  allowDirectCommit = false,
  onCommitDirect,
  branchProtected = false,
  isCommittingDirect = false,
}: ActionsCellProps) => {
  const { kind } = status;
  const showViewYaml = kind === 'Discovered' || kind === 'Issues';
  const showMissingActions = kind === 'Missing';
  const showWaitingActions = kind === 'Waiting';

  return (
    <span data-testid="actions-cell" style={{ whiteSpace: 'nowrap' }}>
      {/* Open repo — always shown */}
      <Tooltip title={TOOLTIP_OPEN_REPO}>
        <IconButton
          size="small"
          component="a"
          href={links.openRepo}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={TOOLTIP_OPEN_REPO}
        >
          <OpenInNewIcon fontSize="small" />
        </IconButton>
      </Tooltip>

      {/* Edit PR — Waiting only */}
      {showWaitingActions &&
        (prUrl ? (
          <Tooltip title={TOOLTIP_EDIT_PR}>
            <IconButton
              size="small"
              component="a"
              href={prUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={TOOLTIP_EDIT_PR}
            >
              <OpenInNewIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        ) : (
          <Tooltip title="PR URL unavailable — rescan to refresh">
            <span>
              <IconButton size="small" disabled aria-label={TOOLTIP_EDIT_PR}>
                <OpenInNewIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
        ))}

      {/* View YAML — Discovered or Issues only */}
      {showViewYaml &&
        (links.viewYaml ? (
          <Tooltip title={TOOLTIP_VIEW_YAML}>
            <IconButton
              size="small"
              component="a"
              href={links.viewYaml}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={TOOLTIP_VIEW_YAML}
            >
              <DescriptionIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        ) : (
          <Tooltip title={disabledTooltip(links.openRepo)}>
            <span>
              <IconButton size="small" disabled aria-label={TOOLTIP_VIEW_YAML}>
                <DescriptionIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
        ))}

      {/* Create YAML on GitHub — Missing with a non-null createYaml link */}
      {showMissingActions && links.createYaml !== null && (
        <Tooltip title={TOOLTIP_CREATE_YAML}>
          <IconButton
            size="small"
            onClick={onCreateYaml}
            aria-label={TOOLTIP_CREATE_YAML}
          >
            <AddCircleOutlineIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      )}

      {/* Onboard via PR — Missing only */}
      {showMissingActions && (
        <Tooltip title={TOOLTIP_ONBOARD}>
          <IconButton
            size="small"
            onClick={onOnboard}
            aria-label={TOOLTIP_ONBOARD}
          >
            <CloudUploadIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      )}

      {/* Commit directly — Missing only, shown when allowDirectCommit is enabled */}
      {showMissingActions && allowDirectCommit && (
        <Tooltip
          title={
            // eslint-disable-next-line no-nested-ternary
            branchProtected
              ? TOOLTIP_BRANCH_PROTECTED
              : isCommittingDirect
              ? TOOLTIP_COMMITTING
              : TOOLTIP_COMMIT_DIRECT
          }
        >
          <span>
            <IconButton
              size="small"
              onClick={onCommitDirect}
              disabled={branchProtected || isCommittingDirect}
              aria-label={
                // eslint-disable-next-line no-nested-ternary
                branchProtected
                  ? TOOLTIP_BRANCH_PROTECTED
                  : isCommittingDirect
                  ? TOOLTIP_COMMITTING
                  : TOOLTIP_COMMIT_DIRECT
              }
            >
              <FlashOnIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
      )}

      {/* Edit metadata — shown for all statuses except Waiting */}
      {!showWaitingActions && (
        <Tooltip title={TOOLTIP_EDIT_METADATA}>
          <IconButton
            size="small"
            onClick={onEditMetadata}
            aria-label={TOOLTIP_EDIT_METADATA}
          >
            <CreateIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      )}
    </span>
  );
};
