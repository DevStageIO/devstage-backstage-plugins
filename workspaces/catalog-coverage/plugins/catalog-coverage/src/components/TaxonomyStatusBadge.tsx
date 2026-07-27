/**
 * TaxonomyStatusBadge — colored Chip + detail Drawer for onboarding taxonomy status.
 * Drawer closes on Escape key and backdrop click (MUI Drawer default).
 */
import { useState } from 'react';
import {
  Chip,
  Drawer,
  Typography,
  List,
  ListItem,
  ListItemText,
  makeStyles,
  Box,
} from '@material-ui/core';
import CheckCircleIcon from '@material-ui/icons/CheckCircle';
import WarningIcon from '@material-ui/icons/Warning';
import CancelIcon from '@material-ui/icons/Cancel';
import BlockIcon from '@material-ui/icons/Block';
import HourglassEmptyIcon from '@material-ui/icons/HourglassEmpty';

export type TaxonomyStatusKind =
  | 'Discovered'
  | 'Issues'
  | 'Missing'
  | 'Waiting'
  | 'Excluded';
export type TaxonomyIssue = { kind: string; message: string; field?: string };
export interface TaxonomyStatus {
  kind: TaxonomyStatusKind;
  issues?: Array<TaxonomyIssue>;
}
export interface TaxonomyStatusBadgeProps {
  status: TaxonomyStatus;
}

const useStyles = makeStyles(theme => ({
  discovered: {
    backgroundColor: theme.palette.primary.main,
    color: theme.palette.primary.contrastText,
  },
  issues: {
    backgroundColor: theme.palette.warning.main,
    color: theme.palette.warning.contrastText,
  },
  missing: {
    backgroundColor: theme.palette.error.main,
    color: theme.palette.error.contrastText,
  },
  waiting: {
    backgroundColor: theme.palette.info.main,
    color: theme.palette.info.contrastText,
  },
  excluded: {},
  drawer: { width: 320, padding: theme.spacing(3) },
}));

const DETAIL: Record<TaxonomyStatusKind, string> = {
  Discovered: 'catalog-info.yaml found and valid.',
  Missing: 'Click Onboard to add catalog-info.yaml',
  Waiting: 'A pull request is open — waiting for review and merge.',
  Excluded: 'This repository is excluded from onboarding',
  Issues: '',
};

const DrawerContent = ({
  status,
  className,
}: {
  status: TaxonomyStatus;
  className: string;
}) => (
  <Box className={className} role="region" aria-label="Status detail">
    <Typography variant="h6" gutterBottom>
      {status.kind}
    </Typography>
    {status.kind === 'Issues' && status.issues?.length ? (
      <List dense>
        {status.issues.map((issue, i) => (
          <ListItem key={i} disableGutters>
            <ListItemText
              primary={issue.message}
              secondary={issue.field ?? issue.kind}
            />
          </ListItem>
        ))}
      </List>
    ) : (
      <Typography variant="body2">{DETAIL[status.kind]}</Typography>
    )}
  </Box>
);

/** Taxonomy-aware status badge with expandable detail drawer. */
export const TaxonomyStatusBadge = ({ status }: TaxonomyStatusBadgeProps) => {
  const classes = useStyles();
  const [open, setOpen] = useState(false);
  const classMap: Record<TaxonomyStatusKind, string> = {
    Discovered: classes.discovered,
    Issues: classes.issues,
    Missing: classes.missing,
    Waiting: classes.waiting,
    Excluded: classes.excluded,
  };
  const iconMap: Record<TaxonomyStatusKind, React.ReactElement> = {
    Discovered: <CheckCircleIcon style={{ fontSize: '0.9rem' }} />,
    Issues: <WarningIcon style={{ fontSize: '0.9rem' }} />,
    Missing: <CancelIcon style={{ fontSize: '0.9rem' }} />,
    Waiting: <HourglassEmptyIcon style={{ fontSize: '0.9rem' }} />,
    Excluded: <BlockIcon style={{ fontSize: '0.9rem' }} />,
  };

  return (
    <>
      <Chip
        size="small"
        icon={iconMap[status.kind]}
        label={status.kind}
        className={classMap[status.kind]}
        onClick={() => setOpen(true)}
        data-testid={`taxonomy-status-badge-${status.kind.toLowerCase()}`}
      />
      <Drawer anchor="right" open={open} onClose={() => setOpen(false)}>
        <DrawerContent status={status} className={classes.drawer} />
      </Drawer>
    </>
  );
};
