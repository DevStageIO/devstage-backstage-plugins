import { BulkJobState, BulkStateManager } from './BulkStateManager';

const SAMPLE_JOB: BulkJobState = {
  rows: [
    { owner: 'zentala', repo: 'my-repo', state: { status: 'pending' } },
    {
      owner: 'zentala',
      repo: 'other-repo',
      state: { status: 'done', prUrl: 'https://github.com/pull/1' },
    },
  ],
  startedAt: '2026-04-29T10:00:00.000Z',
};

describe('BulkStateManager', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('save and load round-trips the job state', () => {
    BulkStateManager.save(SAMPLE_JOB);
    const loaded = BulkStateManager.load();
    expect(loaded).toEqual(SAMPLE_JOB);
  });

  it('load returns null when sessionStorage is empty', () => {
    expect(BulkStateManager.load()).toBeNull();
  });

  it('load returns null for unparseable data', () => {
    sessionStorage.setItem('catalog-coverage.bulk-state', '{not-json}');
    expect(BulkStateManager.load()).toBeNull();
  });

  it('clear removes the saved state', () => {
    BulkStateManager.save(SAMPLE_JOB);
    BulkStateManager.clear();
    expect(BulkStateManager.load()).toBeNull();
  });

  it('overwriting with save stores the new state', () => {
    BulkStateManager.save(SAMPLE_JOB);
    const updated: BulkJobState = {
      ...SAMPLE_JOB,
      completedAt: '2026-04-29T11:00:00.000Z',
    };
    BulkStateManager.save(updated);
    expect(BulkStateManager.load()?.completedAt).toBe(
      '2026-04-29T11:00:00.000Z',
    );
  });
});
