import { Org, Repo, ReposResponse } from './types';

export const MOCK_ORGS: Array<Org> = [
  {
    login: 'acme-corp',
    displayName: 'Acme Corp',
    htmlUrl: 'https://github.com/acme-corp',
  },
  {
    login: 'devstage-io',
    displayName: 'DevStage.io',
    htmlUrl: 'https://github.com/devstage-io',
  },
];

const FIXED_NOW = '2026-04-27T08:00:00.000Z';

const buildRepo = (
  org: string,
  name: string,
  status: Repo['status'],
  options: Partial<Repo> = {},
): Repo => {
  const branch = options.branch ?? 'main';
  const path = options.path ?? 'catalog-info.yaml';
  return {
    name,
    org,
    host: 'github.com',
    branch,
    path,
    htmlUrl: `https://github.com/${org}/${name}/blob/${branch}/${path}`,
    locationRef: `location:default/generated-${org}-${name}`,
    status,
    childCount: status === 'present' ? 1 : 0,
    completeness:
      status === 'present'
        ? {
            avg: 75,
            min: 60,
            children: [
              {
                kind: 'Component',
                name,
                ref: `component:default/${name}`,
                score: 75,
                missing: ['metadata.tags', 'spec.lifecycle'],
              },
            ],
          }
        : undefined,
    lastSeen: FIXED_NOW,
    ...options,
  };
};

export const MOCK_REPOS: Array<Repo> = [
  buildRepo('acme-corp', 'payments-api', 'present', {
    commitCount: 1247,
    defaultBranch: 'main',
  }),
  buildRepo('acme-corp', 'web-storefront', 'present', {
    commitCount: 384,
    defaultBranch: 'main',
  }),
  buildRepo('acme-corp', 'notification-worker', 'missing', {
    commitCount: 59,
    defaultBranch: 'main',
  }),
  buildRepo('acme-corp', 'legacy-batch-jobs', 'missing', {
    branchMismatch: { expectedBranch: 'main', actualDefaultBranch: 'master' },
    commitCount: 12,
    defaultBranch: 'master',
  }),
  buildRepo('devstage-io', 'devstage-portal', 'present', {
    commitCount: 892,
    defaultBranch: 'main',
  }),
  buildRepo('devstage-io', 'devstage-templates', 'missing', {
    commitCount: 34,
    defaultBranch: 'main',
    taxonomyStatus: { kind: 'Waiting' },
    links: {
      openRepo: 'https://github.com/devstage-io/devstage-templates',
      viewYaml: null,
      createYaml: null,
      prUrl: 'https://github.com/devstage-io/devstage-templates/pull/1',
    },
  }),
  buildRepo('devstage-io', 'devstage-docs', 'invalid', {
    commitCount: 7,
    defaultBranch: 'main',
  }),
];

export const MOCK_REPOS_RESPONSE: ReposResponse = {
  repos: MOCK_REPOS,
  summary: {
    total: MOCK_REPOS.length,
    present: MOCK_REPOS.filter(r => r.status === 'present').length,
    missing: MOCK_REPOS.filter(r => r.status === 'missing').length,
    invalid: MOCK_REPOS.filter(r => r.status === 'invalid').length,
  },
};
