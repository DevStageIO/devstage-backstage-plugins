import { Entity } from '@backstage/catalog-model';
import { ScoreResult } from '../types';

const REQUIRED_WEIGHT = 60;
const RECOMMENDED_WEIGHT = 30;
const ANNOTATIONS_WEIGHT = 10;

const RECOMMENDED_FIELDS: Array<{
  key: string;
  getter: (e: Entity) => unknown;
}> = [
  { key: 'metadata.description', getter: e => e.metadata?.description },
  { key: 'metadata.title', getter: e => e.metadata?.title },
  { key: 'metadata.tags', getter: e => e.metadata?.tags },
  {
    key: 'spec.type',
    getter: e => (e.spec as Record<string, unknown> | undefined)?.type,
  },
  {
    key: 'spec.lifecycle',
    getter: e => (e.spec as Record<string, unknown> | undefined)?.lifecycle,
  },
  {
    key: 'spec.owner',
    getter: e => (e.spec as Record<string, unknown> | undefined)?.owner,
  },
];

const RECOMMENDED_ANNOTATIONS = [
  'github.com/project-slug',
  'backstage.io/techdocs-ref',
  'backstage.io/source-location',
];

const isPresent = (value: unknown): boolean => {
  if (value === undefined || value === null) return false;
  if (typeof value === 'string') return value.trim() !== '';
  if (Array.isArray(value)) return value.length > 0;
  return true;
};

/**
 * Score a single child entity against the 3-bucket heuristic locked in the
 * E000-T16 spec.
 *
 * - Required (60): apiVersion, kind, metadata.name, spec — pass/fail.
 * - Recommended (30): % present of 6 standard descriptive fields.
 * - Annotations (10): % present of N recommended annotations.
 */
export const scoreEntity = (entity: Entity): ScoreResult => {
  const missing: Array<string> = [];

  const requiredOk =
    isPresent(entity.apiVersion) &&
    isPresent(entity.kind) &&
    isPresent(entity.metadata?.name) &&
    isPresent(entity.spec);

  for (const field of ['apiVersion', 'kind'] as const) {
    if (!isPresent(entity[field])) missing.push(field);
  }
  if (!isPresent(entity.metadata?.name)) missing.push('metadata.name');
  if (!isPresent(entity.spec)) missing.push('spec');

  const required = requiredOk ? REQUIRED_WEIGHT : 0;

  let recommendedHits = 0;
  for (const field of RECOMMENDED_FIELDS) {
    if (isPresent(field.getter(entity))) {
      recommendedHits += 1;
    } else {
      missing.push(field.key);
    }
  }
  const recommended = Math.round(
    (recommendedHits / RECOMMENDED_FIELDS.length) * RECOMMENDED_WEIGHT,
  );

  const annotations = entity.metadata?.annotations ?? {};
  let annotationHits = 0;
  for (const key of RECOMMENDED_ANNOTATIONS) {
    if (isPresent(annotations[key])) {
      annotationHits += 1;
    } else {
      missing.push(`annotations[${key}]`);
    }
  }
  const annotationsScore = Math.round(
    (annotationHits / RECOMMENDED_ANNOTATIONS.length) * ANNOTATIONS_WEIGHT,
  );

  return {
    total: required + recommended + annotationsScore,
    required,
    recommended,
    annotations: annotationsScore,
    missing,
  };
};
