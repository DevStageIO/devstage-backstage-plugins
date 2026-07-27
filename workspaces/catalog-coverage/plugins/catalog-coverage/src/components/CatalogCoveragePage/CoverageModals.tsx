/**
 * CoverageModals — groups the three per-row modals shown by CatalogCoveragePage
 * (onboard PR, edit metadata, direct-commit confirmation) to keep the page
 * component under the 250-line limit.
 */
import { OnboardModal } from '../OnboardModal';
import { EditMetadataModal } from '../EditMetadataModal';
import { CommitDirectConfirmDialog } from '../CommitDirectConfirmDialog';
import { CommitDirectTarget } from './usePageHandlers';

export type OnboardingRepoState = { owner: string; repo: string } | null;
export type EditingRepoState = {
  owner: string;
  repo: string;
  description: string;
  topics: Array<string>;
} | null;

export interface CoverageModalsProps {
  onboardingRepo: OnboardingRepoState;
  onCloseOnboarding: () => void;
  onOnboardSuccess: (prUrl: string) => void;
  editingRepo: EditingRepoState;
  onCloseEditing: () => void;
  onEditSuccess: () => void;
  confirmTarget: CommitDirectTarget | null;
  onCancelCommitDirect: () => void;
  onConfirmCommitDirect: (yaml: string) => void;
}

/** Renders the onboard/edit-metadata/commit-direct-confirm modals when their state is active. */
export const CoverageModals = ({
  onboardingRepo,
  onCloseOnboarding,
  onOnboardSuccess,
  editingRepo,
  onCloseEditing,
  onEditSuccess,
  confirmTarget,
  onCancelCommitDirect,
  onConfirmCommitDirect,
}: CoverageModalsProps) => (
  <>
    {onboardingRepo && (
      <OnboardModal
        open
        owner={onboardingRepo.owner}
        repo={onboardingRepo.repo}
        onClose={onCloseOnboarding}
        onSuccess={onOnboardSuccess}
      />
    )}

    {editingRepo && (
      <EditMetadataModal
        open
        owner={editingRepo.owner}
        repo={editingRepo.repo}
        initialDescription={editingRepo.description}
        initialTopics={editingRepo.topics}
        onClose={onCloseEditing}
        onSuccess={onEditSuccess}
      />
    )}

    {confirmTarget && (
      <CommitDirectConfirmDialog
        open
        owner={confirmTarget.owner}
        repo={confirmTarget.repo}
        branch={confirmTarget.branch}
        onCancel={onCancelCommitDirect}
        onConfirm={onConfirmCommitDirect}
      />
    )}
  </>
);
