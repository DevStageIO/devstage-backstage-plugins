/**
 * InlineExpandRow — wraps a parent `<TableRow>` with an MUI `<Collapse>`
 * section that reveals child Backstage catalog entities registered under the
 * Location represented by that row.
 *
 * Expanded state is stored in React state AND persisted in `sessionStorage`
 * (key: `catalog-coverage.expanded`) so the user's drill-downs survive
 * page reloads within the same browser session.
 */
import { useEffect, useState } from 'react';
import {
  Collapse,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableRow,
  Tooltip,
  Typography,
} from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import ExpandLessIcon from '@material-ui/icons/ExpandLess';
import ExpandMoreIcon from '@material-ui/icons/ExpandMore';
import { ChildEntity } from '../data/types';
import { ChildComponentRow } from './ChildComponentRow';

const SESSION_KEY = 'catalog-coverage.expanded';
const SECTION_LABEL = 'Backstage catalog entities registered from this repo';
const EMPTY_LABEL = 'No child entities registered yet';

const useStyles = makeStyles(theme => ({
  chevronCell: {
    width: 40,
    padding: theme.spacing(0, 0.5),
  },
  expandArea: {
    paddingBottom: 0,
    paddingTop: 0,
  },
  sectionLabelRow: {
    backgroundColor: theme.palette.background.default,
  },
  sectionLabel: {
    padding: theme.spacing(1, 2),
  },
  nestedTable: {
    marginLeft: theme.spacing(5),
    width: `calc(100% - ${theme.spacing(5)}px)`,
  },
  emptyPlaceholder: {
    padding: theme.spacing(1, 2),
    color: theme.palette.text.disabled,
  },
}));

// --- sessionStorage helpers ------------------------------------------------

const loadExpandedSet = (): Set<string> => {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as Array<string>);
  } catch {
    return new Set();
  }
};

const saveExpandedSet = (set: Set<string>): void => {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(Array.from(set)));
  } catch {
    // sessionStorage unavailable (e.g. private browsing quota) — silently ignore
  }
};

// --- Component types -------------------------------------------------------

export type InlineExpandRowProps = {
  /** Stable key used as the sessionStorage identifier for this row. */
  repoKey: string;
  /** The parent row cells to render (without the chevron cell). */
  rowContent: React.ReactNode;
  /** Child entities shown when expanded. */
  children: Array<ChildEntity>;
  /** Total column count of the parent table (used to set colSpan). */
  colSpan: number;
};

// --- Component -------------------------------------------------------------

/**
 * Wraps a parent table row with an animated `<Collapse>` section for child
 * Backstage entities. Expanded state is persisted in sessionStorage.
 *
 * @param props - Row key, content, children, and parent column count.
 */
export const InlineExpandRow = ({
  repoKey,
  rowContent,
  children,
  colSpan,
}: InlineExpandRowProps) => {
  const classes = useStyles();

  // Initialise from sessionStorage on first render
  const [expandedKeys, setExpandedKeys] =
    useState<Set<string>>(loadExpandedSet);

  const isExpanded = expandedKeys.has(repoKey);

  // Persist to sessionStorage whenever the set changes
  useEffect(() => {
    saveExpandedSet(expandedKeys);
  }, [expandedKeys]);

  const toggleExpanded = () => {
    setExpandedKeys(prev => {
      const next = new Set(prev);
      if (next.has(repoKey)) {
        next.delete(repoKey);
      } else {
        next.add(repoKey);
      }
      return next;
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      toggleExpanded();
    }
  };

  return (
    <>
      {/* Parent row with chevron prepended */}
      <TableRow data-testid="inline-expand-parent-row">
        <TableCell className={classes.chevronCell} padding="none">
          <Tooltip title={isExpanded ? 'Collapse' : 'Expand children'}>
            <IconButton
              size="small"
              aria-label={isExpanded ? 'Collapse children' : 'Expand children'}
              aria-expanded={isExpanded}
              onClick={toggleExpanded}
              onKeyDown={handleKeyDown}
              data-testid="inline-expand-chevron"
            >
              {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            </IconButton>
          </Tooltip>
        </TableCell>
        {rowContent}
      </TableRow>

      {/* Collapsible child section */}
      <TableRow data-testid="inline-expand-collapse-row">
        <TableCell
          className={classes.expandArea}
          colSpan={colSpan + 1} /* +1 for the chevron cell */
          padding="none"
        >
          <Collapse in={isExpanded} timeout={300} unmountOnExit>
            {/* Section label */}
            <TableRow className={classes.sectionLabelRow}>
              <TableCell colSpan={colSpan + 1} className={classes.sectionLabel}>
                <Typography
                  variant="caption"
                  color="textSecondary"
                  data-testid="inline-expand-section-label"
                >
                  {SECTION_LABEL}
                </Typography>
              </TableCell>
            </TableRow>

            {children.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={colSpan + 1}
                  className={classes.emptyPlaceholder}
                >
                  <Typography
                    variant="caption"
                    color="textSecondary"
                    data-testid="inline-expand-empty"
                  >
                    {EMPTY_LABEL}
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              <Table
                size="small"
                className={classes.nestedTable}
                data-testid="inline-expand-child-table"
              >
                <TableBody>
                  {children.map(child => (
                    <ChildComponentRow key={child.entityRef} {...child} />
                  ))}
                </TableBody>
              </Table>
            )}
          </Collapse>
        </TableCell>
      </TableRow>
    </>
  );
};
