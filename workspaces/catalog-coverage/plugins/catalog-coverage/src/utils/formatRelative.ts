/**
 * Lightweight relative-time formatter for repository "last push" display.
 *
 * Returns short human-readable strings like:
 *   "< 1m ago" | "30m ago" | "5h ago" | "2d ago" | "3mo ago" | "2y ago"
 *
 * No external dependencies — keeps the plugin bundle lean.
 */

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;
const MONTH_MS = 30 * DAY_MS;
const YEAR_MS = 365 * DAY_MS;

/**
 * Format an ISO 8601 timestamp as a short relative string.
 *
 * @param iso - ISO 8601 date string (e.g. "2024-06-01T12:00:00Z")
 * @param now - reference timestamp in ms (defaults to `Date.now()`; injectable for tests)
 * @returns Human-readable relative string, or `"—"` if the input is invalid.
 */
export const formatRelative = (
  iso: string | undefined,
  now: number = Date.now(),
): string => {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';

  const diff = now - date.getTime();
  if (diff < 0) return 'just now';
  if (diff < MINUTE_MS) return '< 1m ago';
  if (diff < HOUR_MS) return `${Math.floor(diff / MINUTE_MS)}m ago`;
  if (diff < DAY_MS) return `${Math.floor(diff / HOUR_MS)}h ago`;
  if (diff < MONTH_MS) return `${Math.floor(diff / DAY_MS)}d ago`;
  if (diff < YEAR_MS) return `${Math.floor(diff / MONTH_MS)}mo ago`;
  return `${Math.floor(diff / YEAR_MS)}y ago`;
};
