/**
 * useEntitiesBySlug — batches the catalog lookup for the coverage table.
 *
 * `EnrichedStatusCell` previously ran one `catalogApi.getEntities()` call per
 * rendered row. This hook issues a single call for every `present`/`invalid`
 * row's `github.com/project-slug` and groups the results back by slug, so the
 * page renders N rows with one round-trip instead of N.
 */
import { useMemo } from 'react';
import useAsync from 'react-use/lib/useAsync';
import { useApi } from '@backstage/core-plugin-api';
import { catalogApiRef } from '@backstage/plugin-catalog-react';
import { CatalogEntity, Repo } from '../../data/types';

const PROJECT_SLUG_ANNOTATION = 'github.com/project-slug';

const slugOf = (row: Repo): string => `${row.org}/${row.name}`;

/**
 * Returns a `slug -> entities` map for every `present`/`invalid` row in
 * `repos`. Rows with any other status never had entities and are omitted.
 */
export const useEntitiesBySlug = (
  repos: Array<Repo>,
): Map<string, Array<CatalogEntity>> => {
  const catalogApi = useApi(catalogApiRef);

  const enrichableSlugs = useMemo(
    () =>
      repos
        .filter(row => row.status === 'present' || row.status === 'invalid')
        .map(slugOf),
    [repos],
  );

  const { value: entities } = useAsync(async () => {
    if (enrichableSlugs.length === 0) return [];
    const result = await catalogApi.getEntities({
      filter: {
        [`metadata.annotations.${PROJECT_SLUG_ANNOTATION}`]: enrichableSlugs,
      },
      fields: [
        'kind',
        'metadata.name',
        'metadata.namespace',
        'metadata.annotations',
      ],
    });
    return result.items as Array<
      CatalogEntity & { metadata: { annotations?: Record<string, string> } }
    >;
  }, [enrichableSlugs]);

  return useMemo(() => {
    const map = new Map<string, Array<CatalogEntity>>();
    for (const entity of entities ?? []) {
      const slug = entity.metadata.annotations?.[PROJECT_SLUG_ANNOTATION];
      if (!slug) continue;
      const existing = map.get(slug);
      if (existing) {
        existing.push(entity);
      } else {
        map.set(slug, [entity]);
      }
    }
    return map;
  }, [entities]);
};
