import { CatalogCoverageClient } from './CatalogCoverageApi';

const makeApi = (json: unknown) => {
  const discoveryApi = {
    getBaseUrl: async () => 'http://localhost/api/catalog-coverage',
  };
  const fetchApi = {
    fetch: async () => ({
      ok: true,
      status: 200,
      json: async () => json,
    }),
  };
  return new CatalogCoverageClient({ discoveryApi, fetchApi } as any);
};

describe('CatalogCoverageClient.getSuggestionsBatch', () => {
  it('transforms dict response into array with owner and repo fields', async () => {
    const backendResponse = {
      'zentala/my-plugin': {
        yaml: 'apiVersion: backstage.io/v1alpha1\n',
        signals: {},
        validatorErrors: [],
      },
      'zentala/other-repo': {
        yaml: 'apiVersion: backstage.io/v1alpha1\n',
        signals: {},
        validatorErrors: [],
      },
    };
    const api = makeApi(backendResponse);
    const result = await api.getSuggestionsBatch([
      'zentala/my-plugin',
      'zentala/other-repo',
    ]);

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ owner: 'zentala', repo: 'my-plugin' });
    expect(result[1]).toMatchObject({ owner: 'zentala', repo: 'other-repo' });
    expect(result[0].yaml).toBe('apiVersion: backstage.io/v1alpha1\n');
  });

  it('filters out error entries returned by the backend', async () => {
    const backendResponse = {
      'zentala/good-repo': { yaml: 'y: 1\n', signals: {}, validatorErrors: [] },
      'zentala/broken-repo': { error: 'not found' },
    };
    const api = makeApi(backendResponse);
    const result = await api.getSuggestionsBatch([
      'zentala/good-repo',
      'zentala/broken-repo',
    ]);

    expect(result).toHaveLength(1);
    expect(result[0].repo).toBe('good-repo');
  });

  it('returns empty array when all refs are errors', async () => {
    const api = makeApi({ 'zentala/missing': { error: 'not found' } });
    const result = await api.getSuggestionsBatch(['zentala/missing']);
    expect(result).toEqual([]);
  });

  it('returns empty array for empty dict response', async () => {
    const api = makeApi({});
    const result = await api.getSuggestionsBatch([]);
    expect(result).toEqual([]);
  });
});
