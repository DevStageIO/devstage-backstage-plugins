/**
 * BulkBar — action bar shown when one or more Missing repos are selected.
 *
 * Floats above the table to offer bulk onboard and clear-selection actions.
 * When allowDirectCommit is true, shows a second "Commit directly" button.
 */
import { Box, Button, Paper, Tooltip, Typography } from '@material-ui/core';

export interface BulkBarProps {
  /** Number of repos currently selected (including non-Missing ones). */
  selectedCount: number;
  /** True when at least one selected repo already has catalog-info.yaml. */
  hasNonMissingSelected: boolean;
  /** Called when user confirms bulk onboard via PR. */
  onStart: () => void;
  /** Called when user clears the selection. */
  onClearSelection: () => void;
  /** Called when user clicks "Select all visible Missing". */
  onSelectAllMissing: () => void;
  /** When true, shows the "Commit directly" button alongside "Onboard via PR". */
  allowDirectCommit?: boolean;
  /** Called when user clicks "Commit directly" for bulk repos. */
  onCommitDirectBulk?: () => void;
}

/**
 * Renders an action bar when repos are selected.
 * Returns null when nothing is selected.
 */
export const BulkBar = ({
  selectedCount,
  hasNonMissingSelected,
  onStart,
  onClearSelection,
  onSelectAllMissing,
  allowDirectCommit = false,
  onCommitDirectBulk,
}: BulkBarProps) => {
  if (selectedCount === 0) return null;

  const onboardButton = (
    <Button
      variant="contained"
      color="primary"
      size="small"
      onClick={onStart}
      disabled={hasNonMissingSelected}
    >
      Onboard {selectedCount} repos
    </Button>
  );

  const commitDirectButton = allowDirectCommit ? (
    <Button
      variant="outlined"
      color="primary"
      size="small"
      onClick={onCommitDirectBulk}
      disabled={hasNonMissingSelected}
    >
      Commit directly ({selectedCount})
    </Button>
  ) : null;

  const disabledTooltip =
    'Deselect repos that already have catalog-info.yaml to proceed';

  return (
    <Paper variant="outlined" style={{ marginBottom: 12 }}>
      <Box
        display="flex"
        alignItems="center"
        justifyContent="space-between"
        px={2}
        py={1}
      >
        <Typography variant="body2">
          <strong>{selectedCount}</strong> repos selected
        </Typography>

        <Box display="flex" alignItems="center" style={{ gap: 8 }}>
          <Button size="small" variant="outlined" onClick={onSelectAllMissing}>
            Select all visible Missing
          </Button>

          {hasNonMissingSelected ? (
            <Tooltip title={disabledTooltip}>
              <span>{onboardButton}</span>
            </Tooltip>
          ) : (
            onboardButton
          )}

          {commitDirectButton &&
            (hasNonMissingSelected ? (
              <Tooltip title={disabledTooltip}>
                <span>{commitDirectButton}</span>
              </Tooltip>
            ) : (
              commitDirectButton
            ))}

          <Button size="small" onClick={onClearSelection}>
            Clear selection
          </Button>
        </Box>
      </Box>

      <Box px={2} pb={1}>
        <Typography variant="caption" color="textSecondary">
          Bulk job will run sequentially. Keep this tab open until finished.
        </Typography>
      </Box>
    </Paper>
  );
};
