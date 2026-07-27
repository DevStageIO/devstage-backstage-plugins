import { RepoMetaCache } from './repoMetaCache';

const makeEntry = (
  overrides?: Partial<{
    description: string | null;
    stars: number;
    pushedAt: string;
  }>,
) => {
  const hasDescription = overrides !== undefined && 'description' in overrides;
  return {
    description: (hasDescription ? overrides!.description : 'A repo') as
      | string
      | null,
    stars: overrides?.stars ?? 42,
    pushedAt: overrides?.pushedAt ?? '2024-01-01T00:00:00Z',
  };
};

describe('RepoMetaCache', () => {
  it('returns undefined for a cache miss', () => {
    const cache = new RepoMetaCache();
    expect(cache.get('owner', 'repo')).toBeUndefined();
  });

  it('returns cached value on hit', () => {
    const cache = new RepoMetaCache();
    cache.set('owner', 'repo', makeEntry());
    const result = cache.get('owner', 'repo');
    expect(result).toBeDefined();
    expect(result?.description).toBe('A repo');
    expect(result?.stars).toBe(42);
  });

  it('returns undefined after TTL expiry (injected clock)', () => {
    let now = 0;
    const cache = new RepoMetaCache(() => now);
    cache.set('owner', 'repo', makeEntry());

    // Still valid at 59 min 59 sec
    now = 60 * 60 * 1000 - 1;
    expect(cache.get('owner', 'repo')).toBeDefined();

    // Expired at exactly 1h
    now = 60 * 60 * 1000;
    expect(cache.get('owner', 'repo')).toBeUndefined();
  });

  it('evicts LRU entry at 501st unique key', () => {
    const cache = new RepoMetaCache();

    // Fill to capacity (500)
    for (let i = 0; i < 500; i++) {
      cache.set('owner', `repo-${i}`, makeEntry({ stars: i }));
    }
    expect(cache.size).toBe(500);
    expect(cache.get('owner', 'repo-0')).toBeDefined(); // LRU promoted

    // Insert 501st — oldest (repo-1 because repo-0 was just promoted) is evicted
    cache.set('owner', 'repo-500', makeEntry({ stars: 500 }));
    expect(cache.size).toBe(500);
    // repo-0 was recently accessed (promoted), so repo-1 should be the evicted one
    expect(cache.get('owner', 'repo-1')).toBeUndefined();
    // repo-0 and repo-500 should still be present
    expect(cache.get('owner', 'repo-0')).toBeDefined();
    expect(cache.get('owner', 'repo-500')).toBeDefined();
  });

  it('re-setting an existing key does not grow beyond capacity', () => {
    const cache = new RepoMetaCache();
    for (let i = 0; i < 500; i++) {
      cache.set('owner', `repo-${i}`, makeEntry());
    }
    // Re-set an existing key
    cache.set('owner', 'repo-0', makeEntry({ stars: 999 }));
    expect(cache.size).toBe(500);
    expect(cache.get('owner', 'repo-0')?.stars).toBe(999);
  });

  it('handles null description correctly', () => {
    const cache = new RepoMetaCache();
    cache.set('owner', 'repo', makeEntry({ description: null }));
    const result = cache.get('owner', 'repo');
    expect(result?.description).toBeNull();
  });
});
