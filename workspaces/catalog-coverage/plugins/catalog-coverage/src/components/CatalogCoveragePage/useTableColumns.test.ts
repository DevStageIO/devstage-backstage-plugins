import { Repo } from '../../data/types';
import {
  STATUS_SORT_WEIGHT,
  buildTableColumns,
  compareByStatus,
  mapStatus,
} from './useTableColumns';

const makeRepo = (status: Repo['status']): Repo => ({
  name: `repo-${status}`,
  org: 'zentala',
  host: 'github.com',
  branch: 'main',
  path: 'catalog-info.yaml',
  htmlUrl: `https://github.com/zentala/repo-${status}`,
  locationRef: `url:https://github.com/zentala/repo-${status}/blob/main/catalog-info.yaml`,
  status,
  childCount: status === 'present' ? 1 : 0,
  lastSeen: '2024-01-01T00:00:00Z',
});

const PRESENT = makeRepo('present');
const INVALID = makeRepo('invalid');
const MISSING = makeRepo('missing');

// Build columns once — reused across all sort tests (Finding E).
const cols = buildTableColumns(
  { badgePresent: '', badgeMissing: '', badgeInvalid: '', branchHint: '' },
  () => {},
);
const statusColSort = (() => {
  const col = cols.find(c => c.title === 'Catalog Info Status');
  if (!col?.customSort) throw new Error('customSort not defined');
  return col.customSort as (a: Repo, b: Repo) => number;
})();

describe('STATUS_SORT_WEIGHT', () => {
  it('present < invalid < missing (ascending = present first)', () => {
    // Pin concrete values (Finding C)
    expect(STATUS_SORT_WEIGHT.present).toBe(0);
    expect(STATUS_SORT_WEIGHT.invalid).toBe(1);
    expect(STATUS_SORT_WEIGHT.missing).toBe(2);

    expect(STATUS_SORT_WEIGHT.present).toBeLessThan(STATUS_SORT_WEIGHT.invalid);
    expect(STATUS_SORT_WEIGHT.invalid).toBeLessThan(STATUS_SORT_WEIGHT.missing);
  });

  it('covers all three CatalogInfoStatus values', () => {
    expect(STATUS_SORT_WEIGHT).toHaveProperty('present');
    expect(STATUS_SORT_WEIGHT).toHaveProperty('invalid');
    expect(STATUS_SORT_WEIGHT).toHaveProperty('missing');
  });
});

describe('compareByStatus (named export, Finding D)', () => {
  describe('ascending order: present → invalid → missing', () => {
    it('present sorts before invalid', () => {
      expect(compareByStatus(PRESENT, INVALID)).toBeLessThan(0);
    });

    it('invalid sorts before missing', () => {
      expect(compareByStatus(INVALID, MISSING)).toBeLessThan(0);
    });

    it('present sorts before missing', () => {
      expect(compareByStatus(PRESENT, MISSING)).toBeLessThan(0);
    });
  });

  describe('descending order: missing → invalid → present', () => {
    it('missing sorts before invalid (reversed)', () => {
      expect(compareByStatus(MISSING, INVALID)).toBeGreaterThan(0);
    });

    it('invalid sorts before present (reversed)', () => {
      expect(compareByStatus(INVALID, PRESENT)).toBeGreaterThan(0);
    });

    it('missing sorts before present (reversed)', () => {
      expect(compareByStatus(MISSING, PRESENT)).toBeGreaterThan(0);
    });
  });

  describe('equal status', () => {
    it('present vs present returns 0', () => {
      expect(compareByStatus(PRESENT, PRESENT)).toBe(0);
    });

    it('invalid vs invalid returns 0', () => {
      expect(compareByStatus(INVALID, INVALID)).toBe(0);
    });

    it('missing vs missing returns 0', () => {
      expect(compareByStatus(MISSING, MISSING)).toBe(0);
    });
  });
});

describe('Catalog Info Status column customSort', () => {
  describe('ascending order: present → invalid → missing', () => {
    it('present sorts before invalid', () => {
      expect(statusColSort(PRESENT, INVALID)).toBeLessThan(0);
    });

    it('invalid sorts before missing', () => {
      expect(statusColSort(INVALID, MISSING)).toBeLessThan(0);
    });

    it('present sorts before missing', () => {
      expect(statusColSort(PRESENT, MISSING)).toBeLessThan(0);
    });
  });

  describe('descending order: missing → invalid → present', () => {
    it('missing sorts before invalid (reversed)', () => {
      expect(statusColSort(MISSING, INVALID)).toBeGreaterThan(0);
    });

    it('invalid sorts before present (reversed)', () => {
      expect(statusColSort(INVALID, PRESENT)).toBeGreaterThan(0);
    });

    it('missing sorts before present (reversed)', () => {
      expect(statusColSort(MISSING, PRESENT)).toBeGreaterThan(0);
    });
  });

  describe('equal status', () => {
    it('present vs present returns 0', () => {
      expect(statusColSort(PRESENT, PRESENT)).toBe(0);
    });

    it('invalid vs invalid returns 0', () => {
      expect(statusColSort(INVALID, INVALID)).toBe(0);
    });

    it('missing vs missing returns 0', () => {
      expect(statusColSort(MISSING, MISSING)).toBe(0);
    });
  });
});

describe('mapStatus', () => {
  it('maps present to Discovered', () => {
    expect(mapStatus(PRESENT)).toBe('Discovered');
  });

  it('maps invalid to Issues', () => {
    expect(mapStatus(INVALID)).toBe('Issues');
  });

  it('maps missing to Missing', () => {
    expect(mapStatus(MISSING)).toBe('Missing');
  });

  it('maps missing with taxonomyStatus.kind Waiting to Waiting', () => {
    const waitingRepo = {
      ...MISSING,
      taxonomyStatus: { kind: 'Waiting' as const },
    };
    expect(mapStatus(waitingRepo)).toBe('Waiting');
  });
});
