import React from 'react';
import {
  Box,
  Paper,
  Typography,
  ExpansionPanel,
  ExpansionPanelSummary,
  ExpansionPanelDetails,
  makeStyles,
} from '@material-ui/core';
import ErrorOutlineIcon from '@material-ui/icons/ErrorOutline';
import ExpandMoreIcon from '@material-ui/icons/ExpandMore';
import { CodeSnippet } from '@backstage/core-components';
import { classifyError, PluginErrorPanelProps } from './classifyError';

const useStyles = makeStyles(theme => ({
  paper: {
    borderLeft: `4px solid ${theme.palette.error.main}`,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
  },
  icon: {
    color: theme.palette.error.main,
  },
  accordion: {
    boxShadow: 'none',
    background: 'transparent',
    '&:before': { display: 'none' },
  },
  summary: {
    padding: 0,
    minHeight: 'unset',
    '& .MuiExpansionPanelSummary-content': { margin: 0 },
  },
  details: {
    padding: theme.spacing(1, 0, 0),
    display: 'block',
  },
}));

/** Dev-only error panel: friendly classification + collapsible technical details. */
export const DevErrorPanel: React.FC<PluginErrorPanelProps> = ({ error }) => {
  const classes = useStyles();
  const { title, description } = classifyError(error);
  const rawDetail =
    error instanceof Error ? error.stack ?? error.message : String(error);

  return (
    <Paper className={classes.paper}>
      <Box padding={2}>
        <Box className={classes.header} mb={1}>
          <ErrorOutlineIcon className={classes.icon} />
          <Typography variant="h6">{title}</Typography>
        </Box>

        <Typography variant="body2" color="textSecondary">
          {description}
        </Typography>

        <ExpansionPanel defaultExpanded={false} className={classes.accordion}>
          <ExpansionPanelSummary
            expandIcon={<ExpandMoreIcon />}
            className={classes.summary}
          >
            <Typography variant="caption" color="textSecondary">
              Technical details
            </Typography>
          </ExpansionPanelSummary>
          <ExpansionPanelDetails className={classes.details}>
            <CodeSnippet text={rawDetail} language="text" />
          </ExpansionPanelDetails>
        </ExpansionPanel>
      </Box>
    </Paper>
  );
};
