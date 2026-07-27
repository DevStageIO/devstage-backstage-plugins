import { classifyStatus, ClassifyInput } from './statusClassifier';

const base: ClassifyInput = {
  archived: false,
  annotations: {},
  linksCount: 1,
  hasIssues: false,
};

describe('classifyStatus', () => {
  describe('Excluded', () => {
    it('returns Excluded when archived is true', () => {
      const result = classifyStatus({ ...base, archived: true });
      expect(result.kind).toBe('Excluded');
    });

    it('returns Excluded when skip annotation is present', () => {
      const result = classifyStatus({
        ...base,
        annotations: { 'zentala.io/skip-discovery': 'true' },
      });
      expect(result.kind).toBe('Excluded');
    });

    it('returns Excluded when archived AND skip annotation (archived wins)', () => {
      const result = classifyStatus({
        ...base,
        archived: true,
        annotations: { 'zentala.io/skip-discovery': 'true' },
      });
      expect(result.kind).toBe('Excluded');
    });

    it('Excluded takes precedence over Missing (archived + linksCount 0)', () => {
      const result = classifyStatus({
        ...base,
        archived: true,
        linksCount: 0,
      });
      expect(result.kind).toBe('Excluded');
    });
  });

  describe('Missing', () => {
    it('returns Missing when linksCount is 0', () => {
      const result = classifyStatus({ ...base, linksCount: 0 });
      expect(result.kind).toBe('Missing');
    });

    it('Missing takes precedence over Issues (linksCount 0 + hasIssues)', () => {
      const result = classifyStatus({
        ...base,
        linksCount: 0,
        hasIssues: true,
        issues: [{ kind: 'branch-mismatch', message: 'branch differs' }],
      });
      expect(result.kind).toBe('Missing');
    });
  });

  describe('Issues', () => {
    it('returns Issues when hasIssues is true', () => {
      const result = classifyStatus({
        ...base,
        hasIssues: true,
        issues: [
          { kind: 'branch-mismatch', message: 'expected main, got master' },
        ],
      });
      expect(result.kind).toBe('Issues');
    });

    it('includes the issues array in the result', () => {
      const issue = {
        kind: 'branch-mismatch',
        message: 'branch mismatch',
        field: 'branch',
      };
      const result = classifyStatus({
        ...base,
        hasIssues: true,
        issues: [issue],
      });
      expect(result.issues).toEqual([issue]);
    });

    it('returns Issues with empty array when issues prop is absent', () => {
      const result = classifyStatus({ ...base, hasIssues: true });
      expect(result.kind).toBe('Issues');
      expect(result.issues).toEqual([]);
    });
  });

  describe('Discovered', () => {
    it('returns Discovered for a healthy repo', () => {
      const result = classifyStatus(base);
      expect(result.kind).toBe('Discovered');
    });

    it('returns Discovered when annotations are present but skip annotation is absent', () => {
      const result = classifyStatus({
        ...base,
        annotations: { 'github.com/project-slug': 'zentala/repo' },
      });
      expect(result.kind).toBe('Discovered');
    });

    it('returns Discovered when annotations is undefined', () => {
      const result = classifyStatus({ ...base, annotations: undefined });
      expect(result.kind).toBe('Discovered');
    });
  });
});
