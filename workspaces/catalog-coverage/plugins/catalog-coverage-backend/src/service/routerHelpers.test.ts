import * as yaml from 'js-yaml';
import { applyEnrichment } from './routerHelpers';
import { LlmEnrichment } from '../services/LLMAnalyzer';

const BASE_YAML = `
apiVersion: backstage.io/v1alpha1
kind: Component
metadata:
  name: my-repo
spec:
  type: service
  lifecycle: experimental
  owner: zentala
`.trim();

const ENRICHMENT: LlmEnrichment = {
  description: 'A great service that does things.',
  type: 'library',
  lifecycle: 'development',
  tags: ['typescript', 'backstage', 'rest-api'],
};

describe('applyEnrichment', () => {
  it('writes description, type and lifecycle to YAML', () => {
    const result = yaml.load(applyEnrichment(BASE_YAML, ENRICHMENT)) as any;
    expect(result.metadata.description).toBe(ENRICHMENT.description);
    expect(result.spec.type).toBe(ENRICHMENT.type);
    expect(result.spec.lifecycle).toBe(ENRICHMENT.lifecycle);
  });

  it('writes tags to metadata.tags', () => {
    const result = yaml.load(applyEnrichment(BASE_YAML, ENRICHMENT)) as any;
    expect(result.metadata.tags).toEqual([
      'typescript',
      'backstage',
      'rest-api',
    ]);
  });

  it('omits metadata.tags when enrichment has no tags', () => {
    const enrichmentNoTags: LlmEnrichment = {
      ...ENRICHMENT,
      tags: [],
    };
    const result = yaml.load(
      applyEnrichment(BASE_YAML, enrichmentNoTags),
    ) as any;
    expect(result.metadata.tags).toBeUndefined();
  });

  it('throws on invalid YAML input', () => {
    expect(() => applyEnrichment('null', ENRICHMENT)).toThrow(
      'applyEnrichment',
    );
  });
});
