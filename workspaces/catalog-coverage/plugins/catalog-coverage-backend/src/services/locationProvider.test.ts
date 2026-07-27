import {
  findProvider,
  GithubLocationProvider,
  GitLabLocationProvider,
} from './locationProvider';

// ---------------------------------------------------------------------------
// GithubLocationProvider
// ---------------------------------------------------------------------------

describe('GithubLocationProvider', () => {
  const gh = new GithubLocationProvider();

  describe('hostMatches', () => {
    it('matches github.com URLs', () => {
      expect(gh.hostMatches('https://github.com/owner/repo')).toBe(true);
    });

    it('does not match gitlab.com', () => {
      expect(gh.hostMatches('https://gitlab.com/owner/repo')).toBe(false);
    });

    it('does not match an invalid URL', () => {
      expect(gh.hostMatches('not-a-url')).toBe(false);
    });
  });

  describe('parseRepoUrl', () => {
    it('parses a blob URL (happy path)', () => {
      const result = gh.parseRepoUrl(
        'https://github.com/zentala/big-monorepo/blob/main/catalog-info.yaml',
      );
      expect(result).toEqual({
        owner: 'zentala',
        repo: 'big-monorepo',
        branch: 'main',
      });
    });

    it('parses a URL with a trailing slash', () => {
      const result = gh.parseRepoUrl('https://github.com/zentala/repo/');
      expect(result).toEqual({
        owner: 'zentala',
        repo: 'repo',
        branch: 'main',
      });
    });

    it('strips .git suffix', () => {
      const result = gh.parseRepoUrl('https://github.com/zentala/repo.git');
      expect(result).toEqual({
        owner: 'zentala',
        repo: 'repo',
        branch: 'main',
      });
    });

    it('parses a tree URL', () => {
      const result = gh.parseRepoUrl(
        'https://github.com/zentala/repo/tree/develop',
      );
      expect(result).toEqual({
        owner: 'zentala',
        repo: 'repo',
        branch: 'develop',
      });
    });

    it('returns null for a non-GitHub URL', () => {
      expect(
        gh.parseRepoUrl('https://gitlab.com/owner/repo/blob/main/file'),
      ).toBeNull();
    });

    it('returns null for a malformed URL', () => {
      expect(gh.parseRepoUrl('not-a-url')).toBeNull();
    });

    it('returns null for a sub-path URL with an unrecognised verb', () => {
      expect(
        gh.parseRepoUrl('https://github.com/org/repo/issues/123'),
      ).toBeNull();
    });
  });

  describe('getViewYamlUrl', () => {
    it('returns the blob URL for catalog-info.yaml', () => {
      const parsed = { owner: 'zentala', repo: 'myrepo', branch: 'main' };
      expect(gh.getViewYamlUrl(parsed, 'main')).toBe(
        'https://github.com/zentala/myrepo/blob/main/catalog-info.yaml',
      );
    });
  });

  describe('getCreateYamlUrl', () => {
    it('returns the new-file URL with filename query param', () => {
      const parsed = { owner: 'zentala', repo: 'myrepo', branch: 'main' };
      expect(gh.getCreateYamlUrl(parsed, 'main')).toBe(
        'https://github.com/zentala/myrepo/new/main?filename=catalog-info.yaml',
      );
    });

    it('uses the provided branch (not the parsed one)', () => {
      const parsed = { owner: 'org', repo: 'repo', branch: 'main' };
      expect(gh.getCreateYamlUrl(parsed, 'develop')).toContain('/new/develop?');
    });
  });

  describe('getRepoApiUrl', () => {
    it('returns the repo root URL', () => {
      const parsed = { owner: 'zentala', repo: 'myrepo', branch: 'main' };
      expect(gh.getRepoApiUrl(parsed)).toBe(
        'https://github.com/zentala/myrepo',
      );
    });
  });

  describe('getUserOrOrgUrl', () => {
    it('returns the user profile URL', () => {
      expect(gh.getUserOrOrgUrl('zentala')).toBe('https://github.com/zentala');
    });
  });
});

// ---------------------------------------------------------------------------
// GitLabLocationProvider (stub)
// ---------------------------------------------------------------------------

describe('GitLabLocationProvider', () => {
  const gl = new GitLabLocationProvider();

  describe('hostMatches', () => {
    it('matches gitlab.com', () => {
      expect(gl.hostMatches('https://gitlab.com/owner/repo')).toBe(true);
    });

    it('matches self-hosted gitlab.example.com', () => {
      expect(gl.hostMatches('https://gitlab.example.com/team/svc')).toBe(true);
    });

    it('does not match github.com', () => {
      expect(gl.hostMatches('https://github.com/owner/repo')).toBe(false);
    });
  });

  describe('parseRepoUrl', () => {
    it('returns null for a non-GitLab URL', () => {
      expect(
        gl.parseRepoUrl('https://github.com/zentala/repo/blob/main/file'),
      ).toBeNull();
    });

    it('parses a GitLab blob URL', () => {
      const result = gl.parseRepoUrl(
        'https://gitlab.com/owner/repo/-/blob/main/catalog-info.yaml',
      );
      expect(result).toEqual({ owner: 'owner', repo: 'repo', branch: 'main' });
    });

    it('parses a bare GitLab repo URL', () => {
      const result = gl.parseRepoUrl('https://gitlab.com/owner/repo');
      expect(result).toEqual({ owner: 'owner', repo: 'repo', branch: 'main' });
    });
  });

  describe('stub methods — all return null', () => {
    const parsed = { owner: 'owner', repo: 'repo', branch: 'main' };

    it('getViewYamlUrl returns null', () => {
      expect(gl.getViewYamlUrl(parsed, 'main')).toBeNull();
    });

    it('getCreateYamlUrl returns null', () => {
      expect(gl.getCreateYamlUrl(parsed, 'main')).toBeNull();
    });

    it('getRepoApiUrl returns null', () => {
      expect(gl.getRepoApiUrl(parsed)).toBeNull();
    });

    it('getUserOrOrgUrl returns null', () => {
      expect(gl.getUserOrOrgUrl('owner')).toBeNull();
    });
  });
});

// ---------------------------------------------------------------------------
// findProvider factory
// ---------------------------------------------------------------------------

describe('findProvider', () => {
  it('returns GithubLocationProvider for github.com URLs', () => {
    const provider = findProvider('https://github.com/zentala/repo');
    expect(provider).toBeInstanceOf(GithubLocationProvider);
  });

  it('returns GitLabLocationProvider for gitlab.com URLs', () => {
    const provider = findProvider('https://gitlab.com/owner/repo');
    expect(provider).toBeInstanceOf(GitLabLocationProvider);
  });

  it('returns null for an unrecognised host', () => {
    expect(findProvider('https://example.com/x')).toBeNull();
  });

  it('returns null for a malformed URL', () => {
    expect(findProvider('not-a-url')).toBeNull();
  });
});
