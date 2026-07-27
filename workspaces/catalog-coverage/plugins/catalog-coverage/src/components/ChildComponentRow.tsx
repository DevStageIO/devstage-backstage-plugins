/**
 * ChildComponentRow — renders a single Backstage catalog entity inside the
 * inline-expanded section of the coverage table.
 *
 * One row per child entity (Component, API, Resource, …). ActionsCell wiring
 * (Open in catalog, View source file) is handled by T05; this component
 * exposes the `onOpenCatalog` / `onViewSource` callbacks in props so the
 * wiring is forward-compatible.
 */
import { TableCell, TableRow, Tooltip, Typography } from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import CategoryIcon from '@material-ui/icons/Category';
import { ChildEntity } from '../data/types';

const useStyles = makeStyles(theme => ({
  row: {
    backgroundColor: theme.palette.background.default,
  },
  kindCell: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(0.5),
    color: theme.palette.text.secondary,
    fontSize: '0.8rem',
  },
  nameCell: {
    fontWeight: 500,
  },
  scoreCell: {
    fontVariantNumeric: 'tabular-nums',
    color: theme.palette.text.secondary,
    fontSize: '0.85rem',
  },
  actionsCell: {
    whiteSpace: 'nowrap',
  },
}));

export type ChildComponentRowProps = ChildEntity & {
  /** Called when user clicks "Open in catalog". Wired by T05. */
  onOpenCatalog?: (entityRef: string) => void;
  /** Called when user clicks "View source file". Wired by T05. */
  onViewSource?: (sourceUrl: string) => void;
};

/**
 * Renders one child entity row inside an expanded InlineExpandRow section.
 *
 * @param props - Entity data plus optional action callbacks (T05 wires these).
 */
export const ChildComponentRow = ({
  entityRef,
  kind,
  type,
  name,
  score,
  sourceUrl,
  onOpenCatalog,
  onViewSource,
}: ChildComponentRowProps) => {
  const classes = useStyles();

  const handleOpenCatalog = () => {
    if (onOpenCatalog) onOpenCatalog(entityRef);
  };

  const handleViewSource = () => {
    if (onViewSource && sourceUrl) onViewSource(sourceUrl);
  };

  return (
    <TableRow className={classes.row} data-testid="child-component-row">
      {/* Kind + type column */}
      <TableCell>
        <span className={classes.kindCell}>
          <Tooltip title={`Kind: ${kind}`}>
            <CategoryIcon fontSize="small" />
          </Tooltip>
          <Typography variant="caption" color="textSecondary">
            {kind}/{type}
          </Typography>
        </span>
      </TableCell>

      {/* Name column */}
      <TableCell>
        <span className={classes.nameCell} data-testid="child-entity-name">
          {name}
        </span>
        <Typography
          variant="caption"
          color="textSecondary"
          display="block"
          data-testid="child-entity-ref"
        >
          {entityRef}
        </Typography>
      </TableCell>

      {/* Score column */}
      <TableCell>
        {score !== undefined ? (
          <span className={classes.scoreCell} data-testid="child-entity-score">
            {score}%
          </span>
        ) : (
          <span
            className={classes.scoreCell}
            data-testid="child-entity-score-absent"
          >
            —
          </span>
        )}
      </TableCell>

      {/* Actions placeholder — T05 wires real buttons here */}
      <TableCell
        className={classes.actionsCell}
        data-testid="child-actions-cell"
      >
        {onOpenCatalog ? (
          <button
            type="button"
            onClick={handleOpenCatalog}
            aria-label="Open in catalog"
          >
            Catalog
          </button>
        ) : null}
        {onViewSource && sourceUrl ? (
          <button
            type="button"
            onClick={handleViewSource}
            aria-label="View source file"
          >
            Source
          </button>
        ) : null}
      </TableCell>
    </TableRow>
  );
};
