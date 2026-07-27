/**
 * EnrichedStatusCell — "Catalog Info Status" table cell.
 *
 * For `present` rows: shows status badge + entity kind chips with links.
 * For `invalid` rows: shows status badge + entity name + "YAML error" chip.
 * For `missing` rows: shows status badge only.
 *
 * Pure renderer — entities are resolved once at the page level (batched
 * `catalogApi.getEntities()` call in `useEntitiesBySlug`) and passed in.
 */
import { Box, Chip, makeStyles, Typography } from '@material-ui/core';
import CheckCircleIcon from '@material-ui/icons/CheckCircle';
import CancelIcon from '@material-ui/icons/Cancel';
import WarningIcon from '@material-ui/icons/Warning';
import { Link } from '@backstage/core-components';
import { CatalogEntity, Repo } from '../../data/types';
import { TaxonomyStatusBadge } from '../TaxonomyStatusBadge';
import { TableClasses } from './useTableColumns';

const STATUS_LABEL: Record<Repo['status'], string> = {
  present: 'Present',
  missing: 'Missing',
  invalid: 'Invalid',
};

const STATUS_ICON: Record<Repo['status'], React.ReactElement> = {
  present: <CheckCircleIcon style={{ fontSize: '0.9rem' }} />,
  missing: <CancelIcon style={{ fontSize: '0.9rem' }} />,
  invalid: <WarningIcon style={{ fontSize: '0.9rem' }} />,
};

const STATUS_TO_CLASS_KEY: Record<
  Repo['status'],
  'badgePresent' | 'badgeMissing' | 'badgeInvalid'
> = {
  present: 'badgePresent',
  missing: 'badgeMissing',
  invalid: 'badgeInvalid',
};

const StatusBadge = ({
  status,
  classes,
}: {
  status: Repo['status'];
  classes: TableClasses;
}) => (
  <Chip
    size="small"
    icon={STATUS_ICON[status]}
    label={STATUS_LABEL[status]}
    className={classes[STATUS_TO_CLASS_KEY[status]]}
  />
);

const PresentEntities = ({ entities }: { entities: Array<CatalogEntity> }) => (
  <Box mt={0.5}>
    {entities.map(e => {
      const ns = e.metadata.namespace ?? 'default';
      const kind = e.kind.toLowerCase();
      return (
        <Box
          key={`${e.kind}/${e.metadata.name}`}
          display="flex"
          alignItems="center"
          style={{ gap: 4, marginTop: 2 }}
        >
          <Chip label={e.kind} size="small" style={{ fontSize: 9 }} />
          <Link to={`/catalog/${ns}/${kind}/${e.metadata.name}`}>
            {e.metadata.name}
          </Link>
        </Box>
      );
    })}
  </Box>
);

const useInvalidStyles = makeStyles(theme => ({
  kindChip: { fontSize: 11 },
  errorChip: { color: theme.palette.error.main, fontSize: 11 },
}));

const InvalidEntity = ({ entity }: { entity: CatalogEntity }) => {
  const classes = useInvalidStyles();
  return (
    <Box mt={0.5} display="flex" alignItems="center" style={{ gap: 4 }}>
      <Chip label={entity.kind} size="small" className={classes.kindChip} />
      <Typography variant="caption" color="textSecondary">
        {entity.metadata.name}
      </Typography>
      <Chip label="YAML error" size="small" className={classes.errorChip} />
    </Box>
  );
};

/** Catalog Info Status cell with optional entity enrichment. */
export const EnrichedStatusCell = ({
  row,
  classes,
  entities,
}: {
  row: Repo;
  classes: TableClasses;
  entities: Array<CatalogEntity>;
}) => {
  const useTaxonomyBadge =
    (row.status === 'invalid' || row.taxonomyStatus?.kind === 'Waiting') &&
    !!row.taxonomyStatus;
  const badge = useTaxonomyBadge ? (
    <TaxonomyStatusBadge status={row.taxonomyStatus!} />
  ) : (
    <StatusBadge status={row.status} classes={classes} />
  );

  if (row.status === 'present' && entities.length > 0) {
    return (
      <Box>
        {badge}
        <PresentEntities entities={entities} />
      </Box>
    );
  }

  if (row.status === 'invalid' && entities.length > 0) {
    return (
      <Box>
        {badge}
        <InvalidEntity entity={entities[0]} />
      </Box>
    );
  }

  return <>{badge}</>;
};
