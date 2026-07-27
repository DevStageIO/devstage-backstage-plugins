/**
 * LocationSourceCell — rich 4-line table cell for the "Location Source" column.
 *
 * Line 1: [host icon]  org/name  [🔒/🌐/🏢 visibility]  [★ N]  [⑂ N]  [ARCHIVED]
 * Line 2: GitHub description (optional)
 * Line 3: topic chips (max 5, optional)
 * Line 4: ⎇ default-branch · [clock] X days ago · [history] N commits
 */
import { Box, Chip, makeStyles, Tooltip, Typography } from '@material-ui/core';
import GitHubIcon from '@material-ui/icons/GitHub';
import LinkIcon from '@material-ui/icons/Link';
import CallSplitIcon from '@material-ui/icons/CallSplit';
import StarIcon from '@material-ui/icons/Star';
import AccessTimeIcon from '@material-ui/icons/AccessTime';
import HistoryIcon from '@material-ui/icons/History';
import LockOutlinedIcon from '@material-ui/icons/LockOutlined';
import PublicIcon from '@material-ui/icons/Public';
import BusinessIcon from '@material-ui/icons/Business';
import { Link } from '@backstage/core-components';
import { Repo } from '../../data/types';
import { formatRelative } from '../../utils/formatRelative';

const ICON_STYLE: React.CSSProperties = {
  fontSize: '1rem',
  verticalAlign: 'middle',
};

/**
 * Theme-derived colors for the muted metadata rows. Replaces hardcoded grays
 * (#888/#777) and red (#f44336) so text meets WCAG AA and adapts to dark themes.
 */
const useStyles = makeStyles(theme => ({
  meta: { color: theme.palette.text.secondary },
  metaIcon: { fontSize: '0.85rem', color: theme.palette.text.secondary },
  archivedChip: {
    color: theme.palette.error.main,
    borderColor: theme.palette.error.main,
    fontSize: 11,
  },
}));

const HostIcon = ({ host }: { host: string }) => {
  if (host === 'github.com') {
    return (
      <GitHubIcon
        fontSize="inherit"
        style={ICON_STYLE}
        aria-label="GitHub"
        data-testid="github-icon"
      />
    );
  }
  return (
    <LinkIcon
      fontSize="inherit"
      style={ICON_STYLE}
      aria-label="Git provider"
      data-testid="unknown-provider-icon"
    />
  );
};

const formatRepoStat = (n: number): string => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
};

const StarCount = ({ count }: { count: number }) => {
  const classes = useStyles();
  return (
    <Box
      display="flex"
      alignItems="center"
      style={{ gap: 2 }}
      data-testid="star-count"
    >
      <StarIcon className={classes.metaIcon} />
      <Typography variant="caption" className={classes.meta}>
        {formatRepoStat(count)}
      </Typography>
    </Box>
  );
};

const ForkCount = ({ count }: { count: number }) => {
  const classes = useStyles();
  return (
    <Box display="flex" alignItems="center" style={{ gap: 2 }}>
      <CallSplitIcon className={classes.metaIcon} />
      <Typography variant="caption" className={classes.meta}>
        {formatRepoStat(count)}
      </Typography>
    </Box>
  );
};

const VISIBILITY_ICON_STYLE: React.CSSProperties = {
  fontSize: '0.85rem',
  color: 'inherit',
};

const VISIBILITY_META: Record<
  'public' | 'private' | 'internal',
  { label: string; icon: React.ReactElement }
> = {
  public: {
    label: 'Public repository',
    icon: (
      <PublicIcon
        style={VISIBILITY_ICON_STYLE}
        data-testid="visibility-public-icon"
      />
    ),
  },
  private: {
    label: 'Private repository',
    icon: (
      <LockOutlinedIcon
        style={VISIBILITY_ICON_STYLE}
        data-testid="visibility-private-icon"
      />
    ),
  },
  internal: {
    label: 'Internal repository (org-wide)',
    icon: (
      <BusinessIcon
        style={VISIBILITY_ICON_STYLE}
        data-testid="visibility-internal-icon"
      />
    ),
  },
};

const VisibilityBadge = ({
  visibility,
}: {
  visibility: 'public' | 'private' | 'internal';
}) => {
  const classes = useStyles();
  const meta = VISIBILITY_META[visibility];
  return (
    <Tooltip title={meta.label}>
      <Box
        display="flex"
        alignItems="center"
        className={classes.meta}
        data-testid="visibility-badge"
      >
        {meta.icon}
      </Box>
    </Tooltip>
  );
};

/** Rich 4-line cell for the Location Source column. */
export const LocationSourceCell = ({ row }: { row: Repo }) => {
  const classes = useStyles();
  return (
    <Box>
      {/* Line 1 */}
      <Box
        display="flex"
        alignItems="center"
        style={{ gap: 6, flexWrap: 'wrap' }}
      >
        <HostIcon host={row.host} />
        {row.links?.openRepo ?? row.htmlUrl ? (
          <Link
            to={row.links?.openRepo ?? row.htmlUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            {row.org}/{row.name}
          </Link>
        ) : (
          <span>
            {row.org}/{row.name}
          </span>
        )}
        {row.branchMismatch ? (
          <Tooltip
            title={`File exists on '${row.branchMismatch.actualDefaultBranch}'; Location was registered against '${row.branchMismatch.expectedBranch}'.`}
          >
            <Typography variant="caption" color="textSecondary">
              ↳ branch mismatch
            </Typography>
          </Tooltip>
        ) : null}
        {row.visibility !== undefined && (
          <VisibilityBadge visibility={row.visibility} />
        )}
        {(row.stars ?? 0) > 0 && <StarCount count={row.stars!} />}
        {(row.forks ?? 0) > 0 && <ForkCount count={row.forks!} />}
        {row.archived && (
          <Chip
            label="ARCHIVED"
            size="small"
            variant="outlined"
            className={classes.archivedChip}
          />
        )}
      </Box>
      {/* Line 2: description */}
      {row.description && (
        <Typography
          variant="caption"
          color="textSecondary"
          display="block"
          style={{ marginTop: 4 }}
        >
          {row.description}
        </Typography>
      )}
      {/* Line 3: topics */}
      {row.topics && row.topics.length > 0 && (
        <Box mt={0.5} display="flex" flexWrap="wrap" style={{ gap: 4 }}>
          {row.topics.slice(0, 5).map(t => (
            <Chip key={t} label={t} size="small" variant="outlined" />
          ))}
        </Box>
      )}
      {/* Line 4: branch · last push · commit count */}
      <Box
        mt={0.5}
        display="flex"
        alignItems="center"
        style={{ gap: 4, flexWrap: 'wrap' }}
      >
        <CallSplitIcon className={classes.metaIcon} />
        <Typography variant="caption" className={classes.meta}>
          {row.defaultBranch ?? 'main'} ·
        </Typography>
        <Tooltip title="Last push">
          <Box display="inline-flex" alignItems="center">
            <AccessTimeIcon className={classes.metaIcon} />
          </Box>
        </Tooltip>
        <Typography variant="caption" className={classes.meta}>
          {formatRelative(row.pushedAt)}
        </Typography>
        {row.commitCount !== undefined && (
          <>
            <Typography variant="caption" className={classes.meta}>
              ·
            </Typography>
            <Tooltip title="Total commits">
              <Box display="inline-flex" alignItems="center">
                <HistoryIcon className={classes.metaIcon} />
              </Box>
            </Tooltip>
            <Typography variant="caption" className={classes.meta}>
              {formatRepoStat(row.commitCount)}
            </Typography>
          </>
        )}
      </Box>
    </Box>
  );
};
