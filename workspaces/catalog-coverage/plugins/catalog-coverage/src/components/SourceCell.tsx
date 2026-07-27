/**
 * SourceCell — renders the VCS provider icon + `owner/repo` link for a
 * coverage table row.
 *
 * Tooltip: "Backstage Location source"
 * Icons: GitHub logo for github, generic link icon for unknown/gitlab.
 */
import { Tooltip } from '@material-ui/core';
import GitHubIcon from '@material-ui/icons/GitHub';
import LinkIcon from '@material-ui/icons/Link';
import { Link } from '@backstage/core-components';

export type ProviderKind = 'github' | 'gitlab' | 'unknown';

export interface SourceCellProps {
  provider: ProviderKind;
  owner: string;
  repo: string;
  /** URL to the repository (used as the link href). */
  openRepo: string;
}

const PROVIDER_ICON_SIZE: React.CSSProperties = {
  fontSize: '1rem',
  verticalAlign: 'middle',
  marginRight: 4,
};

const ProviderIcon = ({ provider }: { provider: ProviderKind }) => {
  if (provider === 'github') {
    return (
      <GitHubIcon
        fontSize="inherit"
        style={PROVIDER_ICON_SIZE}
        aria-label="GitHub"
        data-testid="github-icon"
      />
    );
  }
  if (provider === 'gitlab') {
    return (
      <LinkIcon
        fontSize="inherit"
        style={PROVIDER_ICON_SIZE}
        aria-label="GitLab"
        data-testid="gitlab-icon"
      />
    );
  }
  return (
    <LinkIcon
      fontSize="inherit"
      style={PROVIDER_ICON_SIZE}
      aria-label="Unknown provider"
      data-testid="unknown-provider-icon"
    />
  );
};

/**
 * Table cell showing: [provider icon] owner/repo (linked to repository).
 */
export const SourceCell = ({
  provider,
  owner,
  repo,
  openRepo,
}: SourceCellProps) => (
  <Tooltip title="Backstage Location source">
    <span data-testid="source-cell">
      <ProviderIcon provider={provider} />
      <Link to={openRepo} target="_blank" rel="noopener noreferrer">
        {owner}/{repo}
      </Link>
    </span>
  </Tooltip>
);
