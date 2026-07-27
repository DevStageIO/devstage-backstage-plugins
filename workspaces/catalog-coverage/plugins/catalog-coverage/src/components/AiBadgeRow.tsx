/**
 * AiBadgeRow — shows an "AI generated" chip + refresh button when enrichment is present,
 * or a warning when the LLM was attempted but failed.
 */
import {
  CircularProgress,
  Box,
  Chip,
  IconButton,
  Tooltip,
  Typography,
} from '@material-ui/core';
import AutorenewIcon from '@material-ui/icons/Autorenew';
import WarningIcon from '@material-ui/icons/Warning';
import StarsIcon from '@material-ui/icons/Stars';
import type { LlmEnrichment } from '../api/CatalogCoverageApi';

const AI_TOOLTIP = (
  <Box>
    <Typography variant="caption">
      Description, type, lifecycle and tags were suggested by AI based on:
    </Typography>
    <ul style={{ margin: '4px 0 0', paddingLeft: 16 }}>
      <li>
        <Typography variant="caption">
          README (first 2000 characters)
        </Typography>
      </li>
      <li>
        <Typography variant="caption">GitHub repository description</Typography>
      </li>
      <li>
        <Typography variant="caption">GitHub topic tags</Typography>
      </li>
    </ul>
  </Box>
);

export interface AiBadgeRowProps {
  enrichment?: LlmEnrichment;
  llmError?: string;
  refreshing: boolean;
  onRefresh: () => void;
}

/**
 * Renders either an "AI generated" badge row (chip + refresh button)
 * or an LLM-unavailable warning, depending on which props are set.
 *
 * Renders nothing when neither `enrichment` nor `llmError` is present
 * (LLM not configured).
 */
export const AiBadgeRow = ({
  enrichment,
  llmError,
  refreshing,
  onRefresh,
}: AiBadgeRowProps) => {
  if (llmError) {
    return (
      <Box mb={1} display="flex" alignItems="center" style={{ gap: 4 }}>
        <WarningIcon fontSize="small" style={{ color: '#f57c00' }} />
        <Typography variant="caption" style={{ color: '#f57c00' }}>
          AI unavailable — heuristic suggestion
        </Typography>
      </Box>
    );
  }

  if (!enrichment) return null;

  return (
    <Box mb={1} display="flex" alignItems="center" style={{ gap: 4 }}>
      <Tooltip title={AI_TOOLTIP}>
        <Chip
          icon={<StarsIcon fontSize="small" />}
          label="AI generated"
          size="small"
          variant="outlined"
        />
      </Tooltip>
      <Tooltip title="Regenerate AI suggestion (re-reads README and calls AI)">
        <span>
          <IconButton
            size="small"
            aria-label="Regenerate AI suggestion"
            onClick={onRefresh}
            disabled={refreshing}
          >
            {refreshing ? (
              <CircularProgress size={16} />
            ) : (
              <AutorenewIcon fontSize="small" />
            )}
          </IconButton>
        </span>
      </Tooltip>
    </Box>
  );
};
