/**
 * BulkProgressDrawer — right-side drawer for bulk onboarding.
 *
 * Shows a confirmation phase first (repo list + confirm button), then transitions
 * to the progress view once the user confirms.
 */
import {
  Box,
  Button,
  Divider,
  Drawer,
  IconButton,
  LinearProgress,
  Typography,
} from '@material-ui/core';
import CloseIcon from '@material-ui/icons/Close';
import CheckCircleIcon from '@material-ui/icons/CheckCircle';
import ErrorIcon from '@material-ui/icons/Error';
import SkipNextIcon from '@material-ui/icons/SkipNext';
import { BulkJobState, isJobComplete } from '../lib/BulkStateManager';
import { BulkConfirmationPhase } from './BulkConfirmationPhase';
import { BulkProgressList } from './BulkProgressList';

const DRAWER_WIDTH = 720;

export interface BulkProgressDrawerProps {
  open: boolean;
  job: BulkJobState | null;
  isPaused: boolean;
  /** Repos awaiting user confirmation. When set (and job is null), shows the confirmation phase. */
  confirmPending?: Array<{ owner: string; repo: string }> | null;
  /** YAML of the first pending repo — shown as preview during confirmation. */
  yamlPreview?: string;
  onConfirm?: () => void;
  onPause: () => void;
  onResume: () => void;
  onClose: () => void;
  onRetry: (owner: string, repo: string) => void;
}

/**
 * Renders a right-side drawer for bulk onboarding.
 * Phase 1 (confirmation): shows repos to be onboarded + confirm/cancel buttons.
 * Phase 2 (progress): shows per-repo status, progress bar, and pause/resume controls.
 */
export const BulkProgressDrawer = ({
  open,
  job,
  isPaused,
  confirmPending,
  yamlPreview,
  onConfirm,
  onPause,
  onResume,
  onClose,
  onRetry,
}: BulkProgressDrawerProps) => {
  const isConfirmPhase = !!confirmPending?.length && !job;

  const rows = job?.rows ?? [];
  const total = rows.length;
  const done = rows.filter(r => r.state.status === 'done').length;
  const skipped = rows.filter(r => r.state.status === 'skipped').length;
  const failed = rows.filter(
    r => r.state.status === 'failed-retry' || r.state.status === 'failed-perm',
  ).length;
  const terminal = done + skipped + failed;
  const pct = total > 0 ? Math.round((terminal / total) * 100) : 0;
  const allDone = job ? isJobComplete(job) : false;

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      variant="persistent"
      PaperProps={{ style: { width: DRAWER_WIDTH } }}
    >
      {/* Header */}
      <Box
        display="flex"
        alignItems="center"
        justifyContent="space-between"
        px={2}
        py={1}
      >
        <Typography variant="h6">
          {isConfirmPhase ? 'Confirm Bulk Onboard' : 'Bulk Onboard Progress'}
        </Typography>
        <IconButton size="small" onClick={onClose} aria-label="Close drawer">
          <CloseIcon />
        </IconButton>
      </Box>

      <Divider />

      {isConfirmPhase ? (
        <BulkConfirmationPhase
          repos={confirmPending!}
          yamlPreview={yamlPreview}
          onConfirm={onConfirm ?? (() => {})}
          onCancel={onClose}
        />
      ) : (
        <>
          <Box px={2} pt={1} pb={1}>
            <Typography variant="body2" gutterBottom>
              <CheckCircleIcon
                fontSize="inherit"
                style={{ color: 'green', verticalAlign: 'middle' }}
              />{' '}
              {done} done
              {' · '}
              <SkipNextIcon
                fontSize="inherit"
                color="disabled"
                style={{ verticalAlign: 'middle' }}
              />{' '}
              {skipped} skipped
              {' · '}
              <ErrorIcon
                fontSize="inherit"
                color="error"
                style={{ verticalAlign: 'middle' }}
              />{' '}
              {failed} failed
            </Typography>
            <LinearProgress variant="determinate" value={pct} />
          </Box>
          <Divider />
          <Box overflow="auto" flex={1}>
            <BulkProgressList rows={rows} onRetry={onRetry} />
          </Box>
          <Divider />
          <Box
            display="flex"
            justifyContent="flex-end"
            px={2}
            py={1}
            style={{ gap: 8 }}
          >
            {!allDone && !isPaused && (
              <Button size="small" variant="outlined" onClick={onPause}>
                Pause
              </Button>
            )}
            {!allDone && isPaused && (
              <Button
                size="small"
                variant="outlined"
                color="primary"
                onClick={onResume}
              >
                Resume
              </Button>
            )}
            {allDone && (
              <Button size="small" variant="outlined" onClick={onClose}>
                Clear &amp; Close
              </Button>
            )}
          </Box>
        </>
      )}
    </Drawer>
  );
};
