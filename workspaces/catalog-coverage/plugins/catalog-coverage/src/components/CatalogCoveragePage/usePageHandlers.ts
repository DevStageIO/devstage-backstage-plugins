import { useCallback, useMemo, useState } from 'react';
import { ErrorApi } from '@backstage/core-plugin-api';
import { CatalogCoverageApi } from '../../api/CatalogCoverageApi';
import { CatalogImportApi } from '../../lib/OnboardingOrchestrator';
import { Repo } from '../../data/types';
import { isMissingStatus } from './useBulkOrchestrator';

/** Adapts the catalog-coverage API to the OnboardingOrchestrator CatalogImportApi interface. */
export const useCatalogImportAdapter = (
  api: CatalogCoverageApi,
): CatalogImportApi =>
  useMemo(
    () => ({
      submitPullRequest: ({ repositoryUrl, fileContent, title, body }) => {
        const match = repositoryUrl.match(
          /github\.com\/([^/]+)\/([^/]+?)(?:\.git)?(?:\/|$)/,
        );
        if (!match)
          return Promise.reject(
            new Error(`Cannot parse GitHub URL: ${repositoryUrl}`),
          );
        return api.onboardRepo(match[1], match[2], fileContent, title, body);
      },
    }),
    [api],
  );

/** Opens a new tab synchronously (within the user gesture) then navigates to the GitHub
 *  file editor pre-filled with the AI-suggested YAML once the async call resolves. */
export const useCreateYamlHandler = (api: CatalogCoverageApi) =>
  useCallback(
    (repo: Repo) => {
      const fallbackUrl =
        repo.links?.createYaml ??
        `https://github.com/${repo.org}/${repo.name}/new/${
          repo.branch || 'main'
        }?filename=catalog-info.yaml`;
      // Open synchronously within the user-gesture so popup blockers allow it.
      const win = window.open('', '_blank');
      if (!win) return;
      api
        .getSuggestion(repo.org, repo.name)
        .then(suggestion => {
          win.location.href = `${fallbackUrl}&value=${encodeURIComponent(
            suggestion.yaml,
          )}`;
        })
        .catch(() => {
          win.location.href = fallbackUrl;
        });
    },
    [api],
  );

type EditingRepoState = {
  owner: string;
  repo: string;
  description: string;
  topics: Array<string>;
} | null;

/** Manages the sync / reload state for the coverage table. */
export const useSyncHandler = () => {
  const [syncing, setSyncing] = useState(false);
  const [reloadTrigger, setReloadTrigger] = useState(0);
  const handleSync = useCallback(async () => {
    setSyncing(true);
    try {
      setReloadTrigger(t => t + 1);
      await new Promise(resolve => setTimeout(resolve, 50));
    } finally {
      setSyncing(false);
    }
  }, []);
  return { syncing, reloadTrigger, handleSync };
};

/** Manages checkbox selection state for bulk onboarding. */
export const useSelectionState = (filteredRepos: Array<Repo>) => {
  const [selectedRepoKeys, setSelectedRepoKeys] = useState<Set<string>>(
    new Set(),
  );
  const toggleSelect = useCallback((key: string) => {
    setSelectedRepoKeys(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);
  const selectAllMissing = useCallback(() => {
    setSelectedRepoKeys(
      new Set(
        filteredRepos.filter(isMissingStatus).map(r => `${r.org}/${r.name}`),
      ),
    );
  }, [filteredRepos]);
  const hasNonMissingSelected = Array.from(selectedRepoKeys).some(key => {
    const [org, name] = key.split('/');
    const repo = filteredRepos.find(r => r.org === org && r.name === name);
    return repo && !isMissingStatus(repo);
  });
  return {
    selectedRepoKeys,
    setSelectedRepoKeys,
    toggleSelect,
    selectAllMissing,
    hasNonMissingSelected,
  };
};

/** Repo awaiting user confirmation before a direct commit. */
export type CommitDirectTarget = { owner: string; repo: string; branch: string };

/**
 * Manages in-flight direct-commit state, the pending confirmation target,
 * and error feedback. The actual write (`commitDirectRepo`) only happens
 * from `confirmCommitDirect`, never from `requestCommitDirect`.
 */
export const useCommitDirectHandler = (
  api: CatalogCoverageApi,
  errorApi: ErrorApi,
) => {
  const [committingRepos, setCommittingRepos] = useState<Set<string>>(
    new Set(),
  );
  const [confirmTarget, setConfirmTarget] = useState<CommitDirectTarget | null>(
    null,
  );

  /** Opens the confirmation dialog for a row. Issues no request. */
  const requestCommitDirect = useCallback(
    (owner: string, repo: string, branch: string) => {
      setConfirmTarget({ owner, repo, branch });
    },
    [],
  );

  /** Dismisses the confirmation dialog without committing anything. */
  const cancelCommitDirect = useCallback(() => {
    setConfirmTarget(null);
  }, []);

  /** Performs the actual write for the confirmed target, using the given YAML. */
  const confirmCommitDirect = useCallback(
    async (yaml: string) => {
      const target = confirmTarget;
      if (!target) return;
      const { owner, repo } = target;
      const key = `${owner}/${repo}`;
      setConfirmTarget(null);
      setCommittingRepos(prev => new Set(prev).add(key));
      try {
        const result = await api.commitDirectRepo(owner, repo, yaml);
        window.open(result.link, '_blank', 'noopener,noreferrer');
      } catch (err) {
        errorApi.post(
          err instanceof Error ? err : new Error(`Failed to commit ${key}`),
        );
      } finally {
        setCommittingRepos(prev => {
          const next = new Set(prev);
          next.delete(key);
          return next;
        });
      }
    },
    [api, errorApi, confirmTarget],
  );

  return {
    committingRepos,
    confirmTarget,
    requestCommitDirect,
    cancelCommitDirect,
    confirmCommitDirect,
  };
};

/** Opens the EditMetadataModal for the clicked repo. */
export const useEditMetadataHandler = (
  setEditingRepo: (state: EditingRepoState) => void,
) =>
  useCallback(
    (repo: Repo) => {
      setEditingRepo({
        owner: repo.org,
        repo: repo.name,
        description: repo.description ?? '',
        topics: repo.topics ?? [],
      });
    },
    [setEditingRepo],
  );
