import { renderHook, waitFor } from '@testing-library/react';
import { TestApiProvider } from '@backstage/test-utils';
import { catalogApiRef } from '@backstage/plugin-catalog-react';
import { useEntitiesBySlug } from './useEntitiesBySlug';
import { Repo } from '../../data/types';

const makeRepo = (
  status: Repo['status'],
  name: string,
  org = 'zentala',
): Repo => ({
  name,
  org,
  host: 'github.com',
  branch: 'main',
  path: 'catalog-info.yaml',
  htmlUrl: `https://github.com/${org}/${name}`,
  locationRef: `url:https://github.com/${org}/${name}/blob/main/catalog-info.yaml`,
  status,
  childCount: status === 'present' ? 1 : 0,
  lastSeen: '2024-01-01T00:00:00Z',
});

/** Cycles the three coverage statuses so a built table covers each branch. */
const STATUS_CYCLE = ['missing', 'present', 'invalid'] as const;

const buildRows = (count: number): Array<Repo> =>
  Array.from({ length: count }, (_, i) =>
    makeRepo(STATUS_CYCLE[i % STATUS_CYCLE.length], `repo-${i}`),
  );

const wrapper =
  (catalogApi: { getEntities: jest.Mock }) =>
  ({ children }: { children?: React.ReactNode }) =>
    (
      <TestApiProvider apis={[[catalogApiRef, catalogApi]]}>
        {children}
      </TestApiProvider>
    );

describe('useEntitiesBySlug', () => {
  it('issues exactly one getEntities call for a 20-row table', async () => {
    const getEntities = jest.fn().mockResolvedValue({ items: [] });
    const rows = buildRows(20);

    const { result } = renderHook(() => useEntitiesBySlug(rows), {
      wrapper: wrapper({ getEntities }),
    });

    await waitFor(() => expect(getEntities).toHaveBeenCalledTimes(1));
    expect(result.current.size).toBe(0);
  });

  it('requests only present/invalid slugs, not missing ones', async () => {
    const getEntities = jest.fn().mockResolvedValue({ items: [] });
    const rows = [
      makeRepo('present', 'a'),
      makeRepo('invalid', 'b'),
      makeRepo('missing', 'c'),
    ];

    renderHook(() => useEntitiesBySlug(rows), {
      wrapper: wrapper({ getEntities }),
    });

    await waitFor(() => expect(getEntities).toHaveBeenCalledTimes(1));
    const call = getEntities.mock.calls[0][0];
    expect(call.filter['metadata.annotations.github.com/project-slug']).toEqual([
      'zentala/a',
      'zentala/b',
    ]);
  });

  it('groups the response by the project-slug annotation', async () => {
    const getEntities = jest.fn().mockResolvedValue({
      items: [
        {
          kind: 'Component',
          metadata: {
            name: 'a',
            namespace: 'default',
            annotations: { 'github.com/project-slug': 'zentala/a' },
          },
        },
        {
          kind: 'API',
          metadata: {
            name: 'a-api',
            namespace: 'default',
            annotations: { 'github.com/project-slug': 'zentala/a' },
          },
        },
      ],
    });
    const rows = [makeRepo('present', 'a'), makeRepo('missing', 'c')];

    const { result } = renderHook(() => useEntitiesBySlug(rows), {
      wrapper: wrapper({ getEntities }),
    });

    await waitFor(() => expect(result.current.get('zentala/a')?.length).toBe(2));
    expect(result.current.get('zentala/a')?.[0].kind).toBe('Component');
    expect(result.current.has('zentala/c')).toBe(false);
  });

  it('does not call getEntities when there are no present/invalid rows', async () => {
    const getEntities = jest.fn().mockResolvedValue({ items: [] });
    const rows = [makeRepo('missing', 'a')];

    const { result } = renderHook(() => useEntitiesBySlug(rows), {
      wrapper: wrapper({ getEntities }),
    });

    await waitFor(() => expect(result.current.size).toBe(0));
    expect(getEntities).not.toHaveBeenCalled();
  });
});
