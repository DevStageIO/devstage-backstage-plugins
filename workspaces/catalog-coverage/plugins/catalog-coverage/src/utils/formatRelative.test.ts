import { formatRelative } from './formatRelative';

const NOW = new Date('2024-06-15T12:00:00Z').getTime();

const at = (iso: string) => formatRelative(iso, NOW);

describe('formatRelative', () => {
  it('returns "—" for undefined input', () => {
    expect(formatRelative(undefined, NOW)).toBe('—');
  });

  it('returns "—" for an invalid date string', () => {
    expect(formatRelative('not-a-date', NOW)).toBe('—');
  });

  it('returns "< 1m ago" for 30 seconds ago', () => {
    expect(at('2024-06-15T11:59:30Z')).toBe('< 1m ago');
  });

  it('returns minutes for sub-hour gaps', () => {
    expect(at('2024-06-15T11:30:00Z')).toBe('30m ago');
    expect(at('2024-06-15T11:02:00Z')).toBe('58m ago');
  });

  it('returns hours for sub-day gaps', () => {
    expect(at('2024-06-15T06:00:00Z')).toBe('6h ago');
    expect(at('2024-06-14T13:00:00Z')).toBe('23h ago');
  });

  it('returns days for sub-month gaps', () => {
    expect(at('2024-06-13T12:00:00Z')).toBe('2d ago');
    expect(at('2024-05-17T12:00:00Z')).toBe('29d ago');
  });

  it('returns months for sub-year gaps', () => {
    expect(at('2024-03-15T12:00:00Z')).toBe('3mo ago');
    expect(at('2023-07-15T12:00:00Z')).toBe('11mo ago');
  });

  it('returns years for gaps >= 365 days', () => {
    expect(at('2023-06-15T12:00:00Z')).toBe('1y ago');
    expect(at('2022-06-15T12:00:00Z')).toBe('2y ago');
  });

  it('returns "just now" for a future timestamp', () => {
    expect(at('2024-06-15T13:00:00Z')).toBe('just now');
  });
});
