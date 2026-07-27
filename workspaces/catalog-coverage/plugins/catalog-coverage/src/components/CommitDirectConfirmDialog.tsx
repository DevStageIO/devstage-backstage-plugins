/**
 * CommitDirectConfirmDialog — confirmation gate for the single-row "Commit
 * directly" action. Fetches the YAML suggestion when opened (a read, mirroring
 * OnboardModal's fetch-on-open pattern) and reuses BulkConfirmationPhase's
 * presentation (repo/branch summary + YAML preview + confirm/cancel) instead
 * of inventing a second confirmation UI. No write happens until the user
 * confirms.
 */
import { useEffect, useState } from 'react';
import { CircularProgress, Dialog } from '@material-ui/core';
import { useApi } from '@backstage/core-plugin-api';
import { catalogCoverageApiRef } from '../api/CatalogCoverageApi';
import { BulkConfirmationPhase } from './BulkConfirmationPhase';

export interface CommitDirectConfirmDialogProps {
  open: boolean;
  owner: string;
  repo: string;
  /** Default branch the YAML will be committed to. */
  branch: string;
  onCancel: () => void;
  /** Called with the fetched YAML when the user confirms. */
  onConfirm: (yaml: string) => void;
}

/**
 * Dialog shown before a single-row direct commit. Loads the YAML suggestion
 * for preview, then lets the user confirm or cancel. Cancelling never issues
 * a write request.
 */
export const CommitDirectConfirmDialog = ({
  open,
  owner,
  repo,
  branch,
  onCancel,
  onConfirm,
}: CommitDirectConfirmDialogProps) => {
  const api = useApi(catalogCoverageApiRef);
  const [yaml, setYaml] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    setYaml('');
    setLoading(true);
    api
      .getSuggestion(owner, repo)
      .then(suggestion => {
        if (!cancelled) setYaml(suggestion.yaml);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, owner, repo, api]);

  return (
    <Dialog
      open={open}
      onClose={onCancel}
      maxWidth="md"
      fullWidth
      aria-labelledby="commit-direct-confirm-title"
    >
      {loading ? (
        <CircularProgress size={24} style={{ margin: 24 }} />
      ) : (
        <BulkConfirmationPhase
          mode="direct"
          repos={[{ owner, repo }]}
          branch={branch}
          yamlPreview={yaml}
          onConfirm={() => onConfirm(yaml)}
          onCancel={onCancel}
        />
      )}
    </Dialog>
  );
};
