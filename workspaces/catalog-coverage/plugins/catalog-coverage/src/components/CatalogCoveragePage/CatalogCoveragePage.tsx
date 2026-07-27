import { useMemo, useState } from 'react';
import useAsync from 'react-use/lib/useAsync';
import {
  Page,
  Header,
  Content,
  HeaderLabel,
  Table,
  EmptyState,
} from '@backstage/core-components';
import SyncIcon from '@material-ui/icons/Sync';
import { PluginErrorPanel } from '../PluginErrorPanel';
import { useApi, errorApiRef } from '@backstage/core-plugin-api';
import { catalogCoverageApiRef } from '../../api/CatalogCoverageApi';
import { Repo } from '../../data/types';
import { buildTableColumns } from './useTableColumns';
import { useEntitiesBySlug } from './useEntitiesBySlug';
import { CoverageModals } from './CoverageModals';
import { BulkBar } from '../BulkBar';
import { BulkProgressDrawer } from '../BulkProgressDrawer';
import { useBulkOrchestrator } from './useBulkOrchestrator';
import { usePageStyles } from './usePageStyles';
import {
  useCatalogImportAdapter,
  useCommitDirectHandler,
  useCreateYamlHandler,
  useEditMetadataHandler,
  useSyncHandler,
  useSelectionState,
} from './usePageHandlers';

const STATUS_SORT_WEIGHT: Record<string, number> = {
  missing: 0,
  invalid: 1,
  present: 2,
};

export const CatalogCoveragePage = () => {
  const classes = usePageStyles();
  const api = useApi(catalogCoverageApiRef);
  const errorApi = useApi(errorApiRef);
  const config = api.getConfig();
  const catalogImportAdapter = useCatalogImportAdapter(api);
  const handleCreateYaml = useCreateYamlHandler(api);
  const { syncing, reloadTrigger, handleSync } = useSyncHandler();

  const [onboardingRepo, setOnboardingRepo] = useState<{
    owner: string;
    repo: string;
  } | null>(null);
  const [editingRepo, setEditingRepo] = useState<{
    owner: string;
    repo: string;
    description: string;
    topics: Array<string>;
  } | null>(null);

  const bulk = useBulkOrchestrator(api, catalogImportAdapter);
  const {
    committingRepos,
    confirmTarget,
    requestCommitDirect,
    cancelCommitDirect,
    confirmCommitDirect,
  } = useCommitDirectHandler(api, errorApi);

  const { value, loading, error } = useAsync(
    () => api.listRepos(),
    [api, reloadTrigger],
  );
  const repos = useMemo<Array<Repo>>(() => value?.repos ?? [], [value]);

  const sortedRepos = useMemo(
    () =>
      [...repos].sort(
        (a, b) =>
          (STATUS_SORT_WEIGHT[a.status] ?? 3) -
          (STATUS_SORT_WEIGHT[b.status] ?? 3),
      ),
    [repos],
  );

  const summary = useMemo(() => {
    const total = repos.length;
    const present = repos.filter(r => r.status === 'present').length;
    const invalid = repos.filter(r => r.status === 'invalid').length;
    return { total, present, missing: total - present - invalid, invalid };
  }, [repos]);

  const coveragePct =
    summary.total > 0 ? Math.round((summary.present / summary.total) * 100) : 0;

  const {
    selectedRepoKeys,
    setSelectedRepoKeys,
    toggleSelect,
    selectAllMissing,
    hasNonMissingSelected,
  } = useSelectionState(repos);

  const handleEditMetadata = useEditMetadataHandler(setEditingRepo);
  const entitiesBySlug = useEntitiesBySlug(repos);

  const columns = useMemo(
    () =>
      buildTableColumns(
        classes,
        (owner, repo) => setOnboardingRepo({ owner, repo }),
        selectedRepoKeys,
        toggleSelect,
        handleCreateYaml,
        handleEditMetadata,
        config.allowDirectCommit,
        requestCommitDirect,
        committingRepos,
        entitiesBySlug,
      ),
    [
      classes,
      selectedRepoKeys,
      toggleSelect,
      handleCreateYaml,
      handleEditMetadata,
      config.allowDirectCommit,
      requestCommitDirect,
      committingRepos,
      entitiesBySlug,
    ],
  );

  return (
    <Page themeId="tool">
      <Header
        title="GitHub Catalog Info"
        subtitle="catalog-info.yaml coverage across registered Locations"
      >
        <HeaderLabel label="Coverage" value={`${coveragePct}%`} />
        <HeaderLabel label="Present" value={String(summary.present)} />
        <HeaderLabel label="Missing" value={String(summary.missing)} />
        <HeaderLabel label="Invalid" value={String(summary.invalid)} />
      </Header>
      <Content>
        {error ? (
          <PluginErrorPanel error={error} />
        ) : (
          <>
            <BulkBar
              selectedCount={selectedRepoKeys.size}
              hasNonMissingSelected={hasNonMissingSelected}
              onStart={() =>
                bulk
                  .startBulk(repos, selectedRepoKeys)
                  .catch(err => errorApi.post(err))
              }
              onClearSelection={() => setSelectedRepoKeys(new Set())}
              onSelectAllMissing={selectAllMissing}
              allowDirectCommit={false}
            />

            <Table<Repo>
              title={`${summary.present} / ${summary.total} — ${coveragePct}% covered`}
              subtitle="One row = one Backstage Location. Status comes from the catalog join (children matched via backstage.io/managed-by-origin-location) with a UrlReader fallback for unresolved Locations."
              isLoading={loading}
              initialState={{ filtersOpen: true }}
              emptyContent={
                <EmptyState
                  missing="data"
                  title="No locations match the current filter"
                  description="Try clearing the search or selecting a different organization."
                />
              }
              filters={[
                { column: 'Organization', type: 'select' },
                { column: 'Catalog Info Status', type: 'select' },
              ]}
              actions={[
                {
                  icon: () => (
                    <SyncIcon
                      fontSize="small"
                      className={syncing ? classes.spinning : undefined}
                    />
                  ),
                  tooltip: 'Re-check catalog-info.yaml status',
                  isFreeAction: true,
                  disabled: syncing,
                  onClick: handleSync,
                },
              ]}
              options={{
                padding: 'dense',
                pageSize: 20,
                pageSizeOptions: [10, 20, 50],
                search: true,
                actionsColumnIndex: -1,
                loadingType: 'linear',
                hideFilterIcons: true,
              }}
              columns={columns}
              data={sortedRepos}
            />

            <CoverageModals
              onboardingRepo={onboardingRepo}
              onCloseOnboarding={() => setOnboardingRepo(null)}
              onOnboardSuccess={prUrl => {
                setOnboardingRepo(null);
                window.open(prUrl, '_blank', 'noopener,noreferrer');
              }}
              editingRepo={editingRepo}
              onCloseEditing={() => setEditingRepo(null)}
              onEditSuccess={() => {
                setEditingRepo(null);
                handleSync();
              }}
              confirmTarget={confirmTarget}
              onCancelCommitDirect={cancelCommitDirect}
              onConfirmCommitDirect={confirmCommitDirect}
            />

            <BulkProgressDrawer
              open={bulk.bulkDrawerOpen}
              job={bulk.bulkJob}
              isPaused={bulk.isPaused}
              confirmPending={bulk.confirmPending}
              yamlPreview={bulk.confirmYamlPreview ?? undefined}
              onConfirm={bulk.confirmBulk}
              onPause={bulk.handlePause}
              onResume={bulk.handleResume}
              onClose={bulk.closeBulkDrawer}
              onRetry={bulk.handleRetry}
            />
          </>
        )}
      </Content>
    </Page>
  );
};
