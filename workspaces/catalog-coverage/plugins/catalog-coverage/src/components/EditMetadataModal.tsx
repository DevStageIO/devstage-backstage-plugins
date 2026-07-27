/**
 * EditMetadataModal — dialog for editing a GitHub repository's description and topics.
 *
 * Calls updateRepoMetadata on submit; updates are applied directly to GitHub
 * via the server-side GITHUB_TOKEN (no PR required).
 */
import { useState, useEffect, KeyboardEvent } from 'react';
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  Typography,
} from '@material-ui/core';
import { useApi } from '@backstage/core-plugin-api';
import { catalogCoverageApiRef } from '../api/CatalogCoverageApi';

const TOPIC_REGEX = /^[a-z0-9][a-z0-9-]*$/;
const MAX_TOPICS = 20;
const MAX_TOPIC_LENGTH = 50;

export interface EditMetadataModalProps {
  open: boolean;
  owner: string;
  repo: string;
  initialDescription: string;
  initialTopics: Array<string>;
  onClose: () => void;
  onSuccess: () => void;
}

/** Dialog for editing GitHub repo description and topics in-place. */
export const EditMetadataModal = ({
  open,
  owner,
  repo,
  initialDescription,
  initialTopics,
  onClose,
  onSuccess,
}: EditMetadataModalProps) => {
  const api = useApi(catalogCoverageApiRef);

  const [description, setDescription] = useState('');
  const [topics, setTopics] = useState<Array<string>>([]);
  const [topicInput, setTopicInput] = useState('');
  const [topicError, setTopicError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Reset form state whenever the modal opens for a (possibly different) repo
  useEffect(() => {
    if (!open) return;
    setDescription(initialDescription);
    setTopics(initialTopics);
    setTopicInput('');
    setTopicError(null);
    setErrorMessage(null);
  }, [open, owner, repo]); // eslint-disable-line react-hooks/exhaustive-deps

  const addTopic = () => {
    const value = topicInput.trim().toLowerCase();
    if (!value) return;
    if (!TOPIC_REGEX.test(value)) {
      setTopicError(
        'Lowercase letters, numbers, hyphens only. Must start with a letter or number.',
      );
      return;
    }
    if (value.length > MAX_TOPIC_LENGTH) {
      setTopicError(`Max ${MAX_TOPIC_LENGTH} characters per topic.`);
      return;
    }
    if (topics.includes(value)) {
      setTopicError('Topic already added.');
      return;
    }
    if (topics.length >= MAX_TOPICS) {
      setTopicError(`GitHub allows max ${MAX_TOPICS} topics.`);
      return;
    }
    setTopics(prev => [...prev, value]);
    setTopicInput('');
    setTopicError(null);
  };

  const removeTopic = (topic: string) => {
    setTopics(prev => prev.filter(t => t !== topic));
  };

  const handleTopicKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addTopic();
    }
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setErrorMessage(null);
    try {
      await api.updateRepoMetadata(owner, repo, { description, topics });
      onSuccess();
    } catch (err) {
      setErrorMessage((err as Error).message ?? 'Failed to update metadata');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      aria-labelledby="edit-metadata-modal-title"
    >
      <DialogTitle id="edit-metadata-modal-title">
        Edit: {owner}/{repo}
      </DialogTitle>

      <DialogContent>
        <TextField
          fullWidth
          variant="outlined"
          label="Description"
          value={description}
          onChange={e => setDescription(e.target.value)}
          inputProps={{ 'aria-label': 'Repository description' }}
          style={{ marginBottom: 24 }}
        />

        <Typography variant="body2" gutterBottom>
          Topics
        </Typography>

        <Box display="flex" flexWrap="wrap" style={{ gap: 6, marginBottom: 8 }}>
          {topics.map(topic => (
            <Chip
              key={topic}
              label={topic}
              size="small"
              onDelete={() => removeTopic(topic)}
            />
          ))}
        </Box>

        <Box display="flex" style={{ gap: 8 }}>
          <TextField
            variant="outlined"
            size="small"
            placeholder="Add topic…"
            value={topicInput}
            onChange={e => {
              setTopicInput(e.target.value);
              setTopicError(null);
            }}
            onKeyDown={handleTopicKeyDown}
            error={!!topicError}
            helperText={
              topicError ?? 'Lowercase letters, numbers and hyphens only.'
            }
            inputProps={{ 'aria-label': 'New topic input' }}
            style={{ flex: 1 }}
          />
          <Button
            variant="outlined"
            size="small"
            onClick={addTopic}
            disabled={!topicInput.trim()}
            style={{ alignSelf: 'flex-start', marginTop: 2 }}
          >
            Add
          </Button>
        </Box>

        {errorMessage && (
          <Typography
            variant="body2"
            color="error"
            role="alert"
            style={{ marginTop: 12 }}
          >
            {errorMessage}
          </Typography>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} disabled={submitting}>
          Cancel
        </Button>
        <Button
          variant="contained"
          color="primary"
          onClick={handleSubmit}
          disabled={submitting}
        >
          {submitting ? <CircularProgress size={20} /> : 'Save Changes'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
