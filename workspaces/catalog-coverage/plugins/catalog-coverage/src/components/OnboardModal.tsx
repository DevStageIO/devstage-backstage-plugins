/**
 * OnboardModal — dialog for reviewing and submitting a generated catalog-info.yaml PR.
 *
 * Fetches a YAML suggestion, lets the user edit it, then calls OnboardingOrchestrator
 * to submit the PR via CatalogImportApi, or opens GitHub's web editor via "Create file".
 */
import { useEffect, useState } from 'react';
import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Link,
  TextField,
  Typography,
} from '@material-ui/core';
import { useApi } from '@backstage/core-plugin-api';
import {
  catalogCoverageApiRef,
  type SuggestionResponse,
} from '../api/CatalogCoverageApi';
import {
  OnboardingOrchestrator,
  CatalogImportApi,
} from '../lib/OnboardingOrchestrator';
import { AiBadgeRow } from './AiBadgeRow';

const DOCS_URL =
  'https://backstage.io/docs/features/software-catalog/descriptor-format';

/** Message carried by a caught value, or `fallback` when it carries none. */
const messageOf = (err: unknown, fallback: string): string =>
  err instanceof Error && err.message ? err.message : fallback;

/** Minimal YAML validation: non-empty and starts with apiVersion. */
const isValidYaml = (yaml: string): boolean =>
  yaml.trim().length > 0 && yaml.trim().startsWith('apiVersion:');

export interface OnboardModalProps {
  open: boolean;
  owner: string;
  repo: string;
  onClose: () => void;
  onSuccess: (prUrl: string) => void;
}

/**
 * Dialog that shows a generated catalog-info.yaml, lets the user edit it,
 * and submits it as a PR or opens GitHub's web editor for direct file creation.
 */
export const OnboardModal = ({
  open,
  owner,
  repo,
  onClose,
  onSuccess,
}: OnboardModalProps) => {
  const catalogInfoApi = useApi(catalogCoverageApiRef);
  const catalogImportAdapter: CatalogImportApi = {
    submitPullRequest: ({ repositoryUrl, fileContent, title, body }) => {
      const match = repositoryUrl.match(
        /github\.com\/([^/]+)\/([^/]+?)(?:\.git)?(?:\/|$)/,
      );
      if (!match)
        return Promise.reject(
          new Error(`Cannot parse GitHub URL: ${repositoryUrl}`),
        );
      return catalogInfoApi.onboardRepo(
        match[1],
        match[2],
        fileContent,
        title,
        body,
      );
    },
  };

  const [yaml, setYaml] = useState('');
  const [suggestion, setSuggestion] = useState<SuggestionResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Fetch suggestion whenever the modal opens for a new repo.
  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    setYaml('');
    setSuggestion(null);
    setErrorMessage(null);
    setLoading(true);

    catalogInfoApi
      .getSuggestion(owner, repo)
      .then(s => {
        if (!cancelled) {
          setYaml(s.yaml);
          setSuggestion(s);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled)
          setErrorMessage(messageOf(err, 'Failed to load suggestion'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, owner, repo, catalogInfoApi]);

  const handleRefresh = async () => {
    setRefreshing(true);
    setYaml('');
    setErrorMessage(null);
    try {
      const result = await catalogInfoApi.refreshSuggestion(owner, repo);
      setYaml(result.yaml);
      setSuggestion(result);
    } catch (err: unknown) {
      // The API client handles 429 specially — the thrown error already carries
      // "Try again in N seconds" when retryAfterSec is present, so the
      // rate-limit branch only changes which fallback applies without one.
      const rateLimited =
        typeof err === 'object' &&
        err !== null &&
        (err as { status?: unknown }).status === 429;
      setErrorMessage(
        messageOf(
          err,
          rateLimited
            ? 'Too many requests — try again later'
            : 'Failed to refresh suggestion',
        ),
      );
    } finally {
      setRefreshing(false);
    }
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setErrorMessage(null);
    try {
      const orchestrator = new OnboardingOrchestrator(catalogImportAdapter);
      const result = await orchestrator.onboardSingle(owner, repo, yaml);

      if (result.kind === 'success') {
        onSuccess(result.prUrl);
      } else if (result.kind === 'skipped') {
        setErrorMessage('A PR already exists for this repository.');
      } else if (result.kind === 'failed-retry') {
        setErrorMessage(`Rate limited. Try again in 1 minute.`);
      } else {
        setErrorMessage(`Permission error: ${result.reason}`);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const canSubmit = !submitting && !loading && !refreshing && isValidYaml(yaml);
  const createFileUrl =
    `https://github.com/${owner}/${repo}/new/main` +
    `?filename=catalog-info.yaml&value=${encodeURIComponent(yaml)}`;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      aria-labelledby="onboard-modal-title"
    >
      <DialogTitle id="onboard-modal-title">
        Onboard: {owner}/{repo}
      </DialogTitle>

      <DialogContent>
        {loading && <CircularProgress size={24} />}

        {!loading && (
          <>
            <AiBadgeRow
              enrichment={suggestion?.enrichment}
              llmError={suggestion?.llmError}
              refreshing={refreshing}
              onRefresh={handleRefresh}
            />

            <TextField
              multiline
              rows={12}
              fullWidth
              variant="outlined"
              label="catalog-info.yaml"
              value={yaml}
              onChange={e => setYaml(e.target.value)}
              disabled={refreshing}
              inputProps={{ 'aria-label': 'catalog-info.yaml editor' }}
            />

            <Box mt={1}>
              <Typography variant="body2">
                <Link href={DOCS_URL} target="_blank" rel="noopener noreferrer">
                  Learn about catalog-info.yaml fields ↗
                </Link>
              </Typography>
            </Box>

            {errorMessage && (
              <Typography
                variant="body2"
                color="error"
                role="alert"
                style={{ marginTop: 8 }}
              >
                {errorMessage}
              </Typography>
            )}
          </>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} disabled={submitting || refreshing}>
          Cancel
        </Button>
        <Button
          component="a"
          href={createFileUrl}
          target="_blank"
          rel="noopener noreferrer"
          disabled={!canSubmit}
          aria-label="Create catalog-info.yaml directly in GitHub editor (opens new tab)"
        >
          Create file
        </Button>
        <Button
          variant="contained"
          color="primary"
          onClick={handleSubmit}
          disabled={!canSubmit}
        >
          {submitting ? <CircularProgress size={20} /> : 'Open PR'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
