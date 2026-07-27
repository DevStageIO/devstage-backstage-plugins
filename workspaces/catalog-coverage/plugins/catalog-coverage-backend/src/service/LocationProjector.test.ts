import { Entity } from '@backstage/catalog-model';
import { parseGithubBlobUrl, projectLocations } from './LocationProjector';

const location = (
  name: string,
  target: string,
  type: string = 'url',
): Entity => ({
  apiVersion: 'backstage.io/v1alpha1',
  kind: 'Location',
  metadata: { name, namespace: 'default' },
  spec: { type, target },
});

const child = (
  name: string,
  origin: string,
  kind: string = 'Component',
): Entity => ({
  apiVersion: 'backstage.io/v1alpha1',
  kind,
  metadata: {
    name,
    namespace: 'default',
    annotations: { 'backstage.io/managed-by-origin-location': origin },
  },
  spec: { type: 'service' },
});

describe('parseGithubBlobUrl', () => {
  it('parses a typical github blob URL', () => {
    const parts = parseGithubBlobUrl(
      'https://github.com/zentala/big-monorepo/blob/main/catalog-info.yaml',
    );
    expect(parts).toEqual({
      host: 'github.com',
      org: 'zentala',
      name: 'big-monorepo',
      branch: 'main',
      path: 'catalog-info.yaml',
    });
  });

  it('parses nested path segments', () => {
    const parts = parseGithubBlobUrl(
      'https://github.com/org/repo/blob/master/services/api/catalog-info.yaml',
    );
    expect(parts?.path).toBe('services/api/catalog-info.yaml');
    expect(parts?.branch).toBe('master');
  });

  it('returns undefined for non-blob URLs', () => {
    expect(parseGithubBlobUrl('https://github.com/org/repo')).toBeUndefined();
  });

  it('returns undefined for malformed input', () => {
    expect(parseGithubBlobUrl('not-a-url')).toBeUndefined();
  });
});

describe('projectLocations', () => {
  it('marks a Location with ≥1 matching child as present', () => {
    const target =
      'https://github.com/zentala/repo/blob/main/catalog-info.yaml';
    const result = projectLocations(
      [location('zentala-repo', target)],
      [child('repo-svc', `url:${target}`)],
    );
    expect(result).toHaveLength(1);
    expect(result[0].repo.status).toBe('present');
    expect(result[0].repo.childCount).toBe(1);
    expect(result[0].repo.completeness?.children).toHaveLength(1);
    expect(result[0].needsProbe).toBe(false);
  });

  it('flags Locations with 0 children for stage-2 probe', () => {
    const target =
      'https://github.com/zentala/empty/blob/main/catalog-info.yaml';
    const result = projectLocations([location('zentala-empty', target)], []);
    expect(result[0].repo.status).toBe('missing');
    expect(result[0].repo.childCount).toBe(0);
    expect(result[0].needsProbe).toBe(true);
  });

  it('joins multiple children to the same Location', () => {
    const target =
      'https://github.com/zentala/mono/blob/main/catalog-info.yaml';
    const origin = `url:${target}`;
    const result = projectLocations(
      [location('zentala-mono', target)],
      [
        child('a', origin, 'Component'),
        child('b', origin, 'API'),
        child('c', origin, 'Resource'),
      ],
    );
    expect(result[0].repo.childCount).toBe(3);
    expect(result[0].repo.completeness?.children.map(c => c.kind)).toEqual([
      'Component',
      'API',
      'Resource',
    ]);
  });

  it('ignores children whose origin annotation is missing', () => {
    const target =
      'https://github.com/zentala/repo/blob/main/catalog-info.yaml';
    const orphan: Entity = {
      apiVersion: 'backstage.io/v1alpha1',
      kind: 'Component',
      metadata: { name: 'orphan', namespace: 'default' },
      spec: { type: 'service' },
    };
    const result = projectLocations([location('repo', target)], [orphan]);
    expect(result[0].repo.childCount).toBe(0);
  });

  it('reports min/avg of child scores correctly', () => {
    const target =
      'https://github.com/zentala/repo/blob/main/catalog-info.yaml';
    const origin = `url:${target}`;
    const high: Entity = {
      apiVersion: 'backstage.io/v1alpha1',
      kind: 'Component',
      metadata: {
        name: 'high',
        namespace: 'default',
        title: 'High',
        description: 'fully described',
        tags: ['core'],
        annotations: {
          'backstage.io/managed-by-origin-location': origin,
          'github.com/project-slug': 'zentala/repo',
          'backstage.io/techdocs-ref': 'dir:.',
          'backstage.io/source-location': 'url:https://github.com/zentala/repo',
        },
      },
      spec: { type: 'service', lifecycle: 'production', owner: 'team' },
    };
    const low = child('low', origin);
    const result = projectLocations(
      [location('zentala-repo', target)],
      [high, low],
    );
    expect(result[0].repo.completeness).toBeDefined();
    const { avg, min, children } = result[0].repo.completeness!;
    expect(min).toBeLessThan(avg);
    expect(children.find(c => c.name === 'high')?.score).toBe(100);
  });

  it('parses host/org/name from non-GitHub targets without crashing', () => {
    const target =
      'https://gitlab.example.com/team/svc/-/blob/main/catalog-info.yaml';
    const result = projectLocations([location('svc', target)], []);
    expect(result[0].repo.host).toBe('gitlab.example.com');
    expect(result[0].needsProbe).toBe(true);
  });

  it('still emits a row when spec.target is missing', () => {
    const stub: Entity = {
      apiVersion: 'backstage.io/v1alpha1',
      kind: 'Location',
      metadata: { name: 'no-target', namespace: 'default' },
      spec: { type: 'url' },
    };
    const result = projectLocations([stub], []);
    expect(result).toHaveLength(1);
    expect(result[0].repo.locationRef).toBe('location:default/no-target');
    expect(result[0].repo.htmlUrl).toBe('');
  });
});
