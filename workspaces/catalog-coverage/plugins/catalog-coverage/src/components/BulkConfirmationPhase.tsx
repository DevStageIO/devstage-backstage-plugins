/**
 * BulkConfirmationPhase — repo list + PR preview + confirm/cancel buttons shown before bulk onboarding starts.
 */
import {
  Box,
  Button,
  Divider,
  ExpansionPanel,
  ExpansionPanelDetails,
  ExpansionPanelSummary,
  List,
  ListItem,
  ListItemText,
  Typography,
} from '@material-ui/core';
import ExpandMoreIcon from '@material-ui/icons/ExpandMore';
import { CodeSnippet, Link, MarkdownContent } from '@backstage/core-components';
import { DEFAULT_PR_BODY } from '../lib/OnboardingOrchestrator';

const ORCHESTRATOR_SOURCE_URL =
  'https://github.com/zentala/backstage/blob/main/plugins/catalog-coverage/src/lib/OnboardingOrchestrator.ts';

interface BulkConfirmationPhaseProps {
  repos: Array<{ owner: string; repo: string }>;
  /** YAML of the first repo — shown as a representative preview. */
  yamlPreview?: string;
  onConfirm: () => void;
  onCancel: () => void;
  /**
   * 'pr' (default) — bulk onboarding via pull request.
   * 'direct' — single-row commit straight to the repo's default branch, no PR.
   */
  mode?: 'pr' | 'direct';
  /** Branch the YAML will be written to. Only used when mode is 'direct'. */
  branch?: string;
}

const YAML_PREVIEW_LABEL: Record<'pr' | 'direct', string> = {
  pr: 'catalog-info.yaml preview (first repo)',
  direct: 'catalog-info.yaml preview',
};

/** Confirmation step shown before bulk onboarding starts, or before a single direct commit. */
export const BulkConfirmationPhase = ({
  repos,
  yamlPreview,
  onConfirm,
  onCancel,
  mode = 'pr',
  branch,
}: BulkConfirmationPhaseProps) => (
  <>
    <Box px={2} py={2}>
      {mode === 'direct' ? (
        <>
          <Typography variant="body2" gutterBottom>
            <code>catalog-info.yaml</code> will be committed{' '}
            <strong>directly to the {branch ?? 'default'} branch</strong> of{' '}
            <strong>
              {repos[0]?.owner}/{repos[0]?.repo}
            </strong>{' '}
            — no pull request, no review.
          </Typography>
          <Typography variant="body2" color="textSecondary">
            Are you sure you want to proceed?
          </Typography>
        </>
      ) : (
        <>
          <Typography variant="body2" gutterBottom>
            The following <strong>{repos.length}</strong>{' '}
            {repos.length === 1 ? 'repository' : 'repositories'} will be
            submitted as public pull requests with auto-generated{' '}
            <code>catalog-info.yaml</code> descriptions.
          </Typography>
          <Typography variant="body2" color="textSecondary">
            Are you sure you want to proceed with the default descriptions?
          </Typography>
        </>
      )}
    </Box>

    {mode === 'pr' && (
      <ExpansionPanel defaultExpanded>
        <ExpansionPanelSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="caption">PR message preview</Typography>
        </ExpansionPanelSummary>
        <ExpansionPanelDetails>
          <MarkdownContent content={DEFAULT_PR_BODY} />
        </ExpansionPanelDetails>
      </ExpansionPanel>
    )}

    {yamlPreview && (
      <ExpansionPanel defaultExpanded={mode === 'direct'}>
        <ExpansionPanelSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="caption">
            {YAML_PREVIEW_LABEL[mode]}
          </Typography>
        </ExpansionPanelSummary>
        <ExpansionPanelDetails>
          <CodeSnippet language="yaml" text={yamlPreview} />
        </ExpansionPanelDetails>
      </ExpansionPanel>
    )}

    {mode === 'pr' && (
      <Box px={2} py={1}>
        <Typography variant="caption" color="textSecondary">
          PR title and body come from{' '}
          <Link to={ORCHESTRATOR_SOURCE_URL}>OnboardingOrchestrator.ts</Link>.
          YAML content is AI-generated via{' '}
          <Link to="/catalog-coverage/settings">settings</Link>.
        </Typography>
      </Box>
    )}

    {mode === 'pr' && (
      <>
        <Divider />
        <Box overflow="auto" flex={1}>
          <List dense>
            {repos.map(r => (
              <ListItem key={`${r.owner}/${r.repo}`}>
                <ListItemText primary={`${r.owner}/${r.repo}`} />
              </ListItem>
            ))}
          </List>
        </Box>
      </>
    )}
    <Divider />
    <Box
      display="flex"
      justifyContent="flex-end"
      px={2}
      py={1}
      style={{ gap: 8 }}
    >
      <Button size="small" variant="outlined" onClick={onCancel}>
        Cancel
      </Button>
      <Button
        size="small"
        variant="contained"
        color="primary"
        onClick={onConfirm}
      >
        {mode === 'direct' ? 'Confirm & Commit' : 'Confirm & Start'}
      </Button>
    </Box>
  </>
);
