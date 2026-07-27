import { parseCommitCount } from './repoMetaFetcher';

describe('parseCommitCount', () => {
  it('returns 1 when Link header is null (single commit, no pagination)', () => {
    expect(parseCommitCount(null)).toBe(1);
  });

  it('extracts page number from rel="last" link', () => {
    const link =
      '<https://api.github.com/repositories/123/commits?per_page=1&page=247>; rel="last", ' +
      '<https://api.github.com/repositories/123/commits?per_page=1&page=2>; rel="next"';
    expect(parseCommitCount(link)).toBe(247);
  });

  it('returns undefined when Link header has no rel="last"', () => {
    const link =
      '<https://api.github.com/repositories/123/commits?per_page=1&page=1>; rel="prev"';
    expect(parseCommitCount(link)).toBeUndefined();
  });
});
