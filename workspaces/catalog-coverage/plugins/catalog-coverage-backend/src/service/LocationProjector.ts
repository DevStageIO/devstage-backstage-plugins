import { Entity } from '@backstage/catalog-model';
import {
  ChildScore,
  CompletenessAggregate,
  Repo,
  RepoLinks,
  RepoStatus,
} from '../types';
import { findProvider } from '../services/locationProvider';
import { scoreEntity } from './completeness';

/** Annotation core ingestion sets on every entity, pointing at its Location target. */
export const ORIGIN_ANNOTATION = 'backstage.io/managed-by-origin-location';
const URL_PREFIX = 'url:';

export type ProjectedRepo = {
  repo: Repo;
  /**
   * True when no child entity was found via the catalog join. Stage-2
   * (UrlReader probe) is required to distinguish `missing` from `invalid`.
   */
  needsProbe: boolean;
};

const stripUrlPrefix = (value: string): string =>
  value.startsWith(URL_PREFIX) ? value.slice(URL_PREFIX.length) : value;

/**
 * Parse a GitHub `blob` URL into its parts via `GithubLocationProvider`.
 * Returns `undefined` for any non-GitHub, non-blob, or malformed target so
 * callers (UrlProbe, projectOne) can fall back gracefully.
 *
 * Contract preserved from T16: ONLY GitHub blob URLs produce a result.
 * Bare repo URLs and non-GitHub hosts intentionally return `undefined`.
 *
 * Example input:
 *   https://github.com/acme-corp/big-monorepo/blob/main/catalog-info.yaml
 */
export const parseGithubBlobUrl = (
  target: string,
):
  | { host: string; org: string; name: string; branch: string; path: string }
  | undefined => {
  let url: URL;
  try {
    url = new URL(target);
  } catch {
    return undefined;
  }
  if (!url.hostname) return undefined;
  // Only GitHub blob URLs are supported by this function
  const segments = url.pathname.split('/').filter(Boolean);
  // expected: [org, repo, 'blob', branch, ...path]
  if (segments.length < 5 || segments[2] !== 'blob') return undefined;
  const provider = findProvider(target);
  if (!provider) return undefined;
  const parsed = provider.parseRepoUrl(target);
  if (!parsed) return undefined;
  const blobIdx = segments.indexOf('blob');
  const path = blobIdx >= 0 ? segments.slice(blobIdx + 2).join('/') : '';
  return {
    host: url.hostname,
    org: parsed.owner,
    name: parsed.repo,
    branch: parsed.branch,
    path,
  };
};

/**
 * Build provider-generated links for a repo row.
 * Falls back to empty strings / null for unrecognised hosts.
 */
const buildLinks = (target: string, branch: string): RepoLinks | undefined => {
  const provider = findProvider(target);
  if (!provider) return undefined;
  const parsed = provider.parseRepoUrl(target);
  if (!parsed) return undefined;
  const useBranch = branch || parsed.branch;
  return {
    viewYaml: provider.getViewYamlUrl(parsed, useBranch),
    createYaml: provider.getCreateYamlUrl(parsed, useBranch),
    openRepo: provider.getRepoApiUrl(parsed) ?? target,
  };
};

const aggregateChildren = (children: Array<Entity>): CompletenessAggregate => {
  const scored: Array<ChildScore> = children.map(entity => {
    const result = scoreEntity(entity);
    return {
      kind: entity.kind,
      name: entity.metadata.name,
      ref: `${entity.kind}:${entity.metadata.namespace ?? 'default'}/${
        entity.metadata.name
      }`,
      score: result.total,
      missing: result.missing,
    };
  });
  if (scored.length === 0) {
    return { avg: 0, min: 0, children: [] };
  }
  const sum = scored.reduce((acc, child) => acc + child.score, 0);
  return {
    avg: Math.round(sum / scored.length),
    min: Math.min(...scored.map(c => c.score)),
    children: scored,
  };
};

const buildLocationRef = (entity: Entity): string =>
  `location:${entity.metadata.namespace ?? 'default'}/${entity.metadata.name}`;

/**
 * Project a Location entity + its joined children into a `Repo` row.
 *
 * Handles both the happy path (`spec.target` is a parseable GitHub URL with
 * children) and degenerate inputs (non-GitHub targets, missing fields).
 * Non-GitHub Locations are surfaced with `host`/`org`/`name` derived from
 * whatever URL parts are available, so they remain visible in the table.
 */
const projectOne = (
  location: Entity,
  childrenForLocation: Array<Entity>,
): ProjectedRepo => {
  const target = (location.spec as Record<string, unknown> | undefined)?.target;
  const targetStr = typeof target === 'string' ? target : '';
  const parsed = parseGithubBlobUrl(targetStr);

  const status: RepoStatus =
    childrenForLocation.length > 0 ? 'present' : 'missing';
  const completeness =
    childrenForLocation.length > 0
      ? aggregateChildren(childrenForLocation)
      : undefined;

  let host = '';
  let org = '';
  let name = '';
  let branch = '';
  let path = '';
  let htmlUrl = targetStr;
  if (parsed) {
    ({ host, org, name, branch, path } = parsed);
    htmlUrl = targetStr;
  } else if (targetStr) {
    try {
      const url = new URL(targetStr);
      host = url.hostname;
      const segments = url.pathname.split('/').filter(Boolean);
      org = segments[0] ?? '';
      name = segments[1] ?? '';
    } catch {
      // leave host/org/name blank; row still rendered with locationRef
    }
  }

  const links = targetStr ? buildLinks(targetStr, branch) : undefined;

  const repo: Repo = {
    name: name || location.metadata.name,
    org,
    host,
    branch,
    path,
    htmlUrl,
    locationRef: buildLocationRef(location),
    status,
    childCount: childrenForLocation.length,
    completeness,
    lastSeen: new Date().toISOString(),
    links,
  };

  return {
    repo,
    needsProbe: childrenForLocation.length === 0,
  };
};

/**
 * Stage-1 projection: catalog Locations + non-Location entities → Repo[].
 *
 * Locations are matched against children via the
 * `backstage.io/managed-by-origin-location` annotation (set by core
 * ingestion regardless of provider). Children whose annotation is absent or
 * does not match any Location's `spec.target` are silently dropped from the
 * projection; a structured warning could be wired in by callers.
 */
export const projectLocations = (
  locations: Array<Entity>,
  children: Array<Entity>,
): Array<ProjectedRepo> => {
  const childrenByOrigin = new Map<string, Array<Entity>>();
  for (const child of children) {
    const annotation = child.metadata?.annotations?.[ORIGIN_ANNOTATION];
    if (!annotation) continue;
    const origin = stripUrlPrefix(annotation);
    const bucket = childrenByOrigin.get(origin);
    if (bucket) {
      bucket.push(child);
    } else {
      childrenByOrigin.set(origin, [child]);
    }
  }

  return locations.map(location => {
    const target = (location.spec as Record<string, unknown> | undefined)
      ?.target;
    const targetStr = typeof target === 'string' ? target : '';
    const matchedChildren = childrenByOrigin.get(targetStr) ?? [];
    return projectOne(location, matchedChildren);
  });
};
