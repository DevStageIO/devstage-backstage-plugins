import { Entity } from '@backstage/catalog-model';
import { scoreEntity } from './completeness';

const minimalEntity = (): Entity => ({
  apiVersion: 'backstage.io/v1alpha1',
  kind: 'Component',
  metadata: { name: 'svc' },
  spec: { type: 'service' },
});

describe('scoreEntity', () => {
  it('gives 60 for a minimal-but-valid entity (required only)', () => {
    const score = scoreEntity(minimalEntity());
    expect(score.required).toBe(60);
    // 1 of 6 recommended (spec.type) → 5
    expect(score.recommended).toBe(5);
    expect(score.annotations).toBe(0);
    expect(score.total).toBe(65);
  });

  it('gives 0 required when apiVersion is missing', () => {
    const entity = minimalEntity();
    delete (entity as { apiVersion?: string }).apiVersion;
    const score = scoreEntity(entity);
    expect(score.required).toBe(0);
    expect(score.missing).toContain('apiVersion');
  });

  it('gives 0 required when spec is empty/absent', () => {
    const entity = minimalEntity();
    delete (entity as { spec?: unknown }).spec;
    const score = scoreEntity(entity);
    expect(score.required).toBe(0);
    expect(score.missing).toContain('spec');
  });

  it('awards full recommended when all 6 fields are present', () => {
    const entity: Entity = {
      apiVersion: 'backstage.io/v1alpha1',
      kind: 'Component',
      metadata: {
        name: 'svc',
        title: 'Svc',
        description: 'a service',
        tags: ['core'],
      },
      spec: { type: 'service', lifecycle: 'production', owner: 'team-a' },
    };
    const score = scoreEntity(entity);
    expect(score.recommended).toBe(30);
  });

  it('awards full annotations when all 3 recommended annotations present', () => {
    const entity: Entity = {
      apiVersion: 'backstage.io/v1alpha1',
      kind: 'Component',
      metadata: {
        name: 'svc',
        annotations: {
          'github.com/project-slug': 'org/svc',
          'backstage.io/techdocs-ref': 'dir:.',
          'backstage.io/source-location':
            'url:https://github.com/org/svc/tree/main',
        },
      },
      spec: { type: 'service' },
    };
    const score = scoreEntity(entity);
    expect(score.annotations).toBe(10);
  });

  it('reaches 100 when required + recommended + annotations all complete', () => {
    const entity: Entity = {
      apiVersion: 'backstage.io/v1alpha1',
      kind: 'Component',
      metadata: {
        name: 'svc',
        title: 'Svc',
        description: 'a service',
        tags: ['core'],
        annotations: {
          'github.com/project-slug': 'org/svc',
          'backstage.io/techdocs-ref': 'dir:.',
          'backstage.io/source-location':
            'url:https://github.com/org/svc/tree/main',
        },
      },
      spec: { type: 'service', lifecycle: 'production', owner: 'team-a' },
    };
    expect(scoreEntity(entity).total).toBe(100);
  });

  it('treats empty arrays/strings as missing', () => {
    const entity: Entity = {
      apiVersion: 'backstage.io/v1alpha1',
      kind: 'Component',
      metadata: { name: 'svc', description: '   ', tags: [] },
      spec: { type: 'service' },
    };
    const score = scoreEntity(entity);
    expect(score.missing).toContain('metadata.description');
    expect(score.missing).toContain('metadata.tags');
  });

  it('lists all missing fields in the missing[] output', () => {
    const score = scoreEntity(minimalEntity());
    expect(score.missing).toEqual(
      expect.arrayContaining([
        'metadata.description',
        'metadata.title',
        'metadata.tags',
        'spec.lifecycle',
        'spec.owner',
        'annotations[github.com/project-slug]',
      ]),
    );
  });
});
