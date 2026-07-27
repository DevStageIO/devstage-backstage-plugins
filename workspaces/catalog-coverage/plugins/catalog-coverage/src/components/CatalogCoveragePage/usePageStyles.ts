import { makeStyles } from '@material-ui/core';

export const usePageStyles = makeStyles(theme => ({
  '@keyframes spin': {
    from: { transform: 'rotate(0deg)' },
    to: { transform: 'rotate(360deg)' },
  },
  spinning: { animation: '$spin 1s linear infinite' },
  badgePresent: {
    backgroundColor: theme.palette.success.main,
    color: theme.palette.success.contrastText,
  },
  badgeMissing: {
    backgroundColor: theme.palette.error.main,
    color: theme.palette.error.contrastText,
  },
  badgeInvalid: {
    backgroundColor: theme.palette.warning.main,
    color: theme.palette.warning.contrastText,
  },
  branchHint: {
    display: 'block',
    fontSize: '0.75rem',
    color: theme.palette.text.secondary,
  },
}));
