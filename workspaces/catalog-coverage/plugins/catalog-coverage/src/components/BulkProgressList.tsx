/**
 * BulkProgressList — per-row status list for bulk onboarding progress view.
 *
 * Extracted from BulkProgressDrawer to stay within the 250-line limit.
 */
import {
  Button,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Tooltip,
} from '@material-ui/core';
import CheckCircleIcon from '@material-ui/icons/CheckCircle';
import ErrorIcon from '@material-ui/icons/Error';
import HourglassEmptyIcon from '@material-ui/icons/HourglassEmpty';
import SkipNextIcon from '@material-ui/icons/SkipNext';
import SyncIcon from '@material-ui/icons/Sync';
import WarningIcon from '@material-ui/icons/Warning';
import { Link } from '@backstage/core-components';
import { BulkJobState, BulkRowState } from '../lib/BulkStateManager';

/** Maps a row status to a display icon. */
const StatusIcon = ({ state }: { state: BulkRowState }) => {
  switch (state.status) {
    case 'pending':
      return <HourglassEmptyIcon fontSize="small" />;
    case 'in-flight':
      return <SyncIcon fontSize="small" color="primary" />;
    case 'done':
      return (
        <CheckCircleIcon
          fontSize="small"
          color="action"
          style={{ color: 'green' }}
        />
      );
    case 'skipped':
      return <SkipNextIcon fontSize="small" color="disabled" />;
    case 'failed-retry':
      return <WarningIcon fontSize="small" color="error" />;
    case 'failed-perm':
      return <ErrorIcon fontSize="small" color="error" />;
    default:
      return null;
  }
};

/** Returns a short human-readable label for a row state. */
const statusLabel = (state: BulkRowState): string => {
  switch (state.status) {
    case 'pending':
      return 'Pending';
    case 'in-flight':
      return 'In flight';
    case 'done':
      return 'Done';
    case 'skipped':
      return 'Skipped';
    case 'failed-retry':
      return `Retry: ${state.reason}`;
    case 'failed-perm':
      return `Failed: ${state.reason}`;
    default:
      return '';
  }
};

/** Secondary content for a skipped row: tooltip + "Edit PR" link. */
const SkippedRowSecondary = ({
  row,
}: {
  row: {
    owner: string;
    repo: string;
    state: BulkRowState & { status: 'skipped' };
  };
}) => (
  <>
    {' '}
    <Tooltip title="A PR already exists for this repository">
      <span>PR already exists</span>
    </Tooltip>
    {' · '}
    <Link
      to={
        row.state.prUrl ?? `https://github.com/${row.owner}/${row.repo}/pulls`
      }
    >
      Edit PR
    </Link>
  </>
);

interface BulkProgressListProps {
  rows: BulkJobState['rows'];
  onRetry: (owner: string, repo: string) => void;
}

/** Dense list showing per-row onboarding status with links and actions. */
export const BulkProgressList = ({ rows, onRetry }: BulkProgressListProps) => (
  <List dense>
    {rows.map(row => {
      const key = `${row.owner}/${row.repo}`;
      const isDoneRow = row.state.status === 'done';
      const isRetryRow = row.state.status === 'failed-retry';
      const isSkippedRow = row.state.status === 'skipped';
      return (
        <ListItem key={key} alignItems="flex-start">
          <ListItemIcon style={{ minWidth: 32 }}>
            <StatusIcon state={row.state} />
          </ListItemIcon>
          <ListItemText
            primary={key}
            secondary={
              <>
                <span>{statusLabel(row.state)}</span>
                {isDoneRow && (
                  <>
                    {' '}
                    <Link
                      to={(row.state as { prUrl: string }).prUrl}
                      target="_blank"
                    >
                      View PR
                    </Link>
                  </>
                )}
                {isSkippedRow && (
                  <SkippedRowSecondary
                    row={{
                      ...row,
                      state: row.state as BulkRowState & { status: 'skipped' },
                    }}
                  />
                )}
                {isRetryRow && (
                  <>
                    {' '}
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() => onRetry(row.owner, row.repo)}
                    >
                      Retry
                    </Button>
                  </>
                )}
              </>
            }
          />
        </ListItem>
      );
    })}
  </List>
);
