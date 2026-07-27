/**
 * Sliding-window rate limiter: an optional per-key cooldown plus global
 * per-minute and per-hour caps. Extracted from the refresh route so the same
 * throttle protects every billed endpoint (GitHub + OpenAI calls) and is
 * unit-testable in isolation.
 *
 * State is in-memory and instance-scoped: it resets on restart and does not
 * coordinate across horizontally-scaled replicas. Acceptable for a
 * single-replica self-hosted portal; documented as a known limitation.
 */

const MINUTE_MS = 60_000;
const HOUR_MS = 3_600_000;

export type RateLimitDecision =
  | { limited: false }
  | { limited: true; retryAfterSec: number };

const retryAfter = (windowMs: number, elapsed: number): number =>
  Math.ceil((windowMs - elapsed) / 1000);

export class SlidingWindowRateLimiter {
  private readonly lastByKey = new Map<string, number>();
  private readonly globalLog: Array<number> = [];

  constructor(
    private readonly cooldownMs: number,
    private readonly maxPerMin: number,
    private readonly maxPerHr: number,
  ) {}

  /**
   * Check whether a hit for `key` is allowed at `now` (epoch ms).
   * Pure check — does NOT record the hit; call {@link record} after the guarded
   * operation actually proceeds (so cache-hits / skips don't consume budget).
   */
  check(key: string, now: number): RateLimitDecision {
    const last = this.lastByKey.get(key);
    if (last !== undefined && now - last < this.cooldownMs) {
      return {
        limited: true,
        retryAfterSec: retryAfter(this.cooldownMs, now - last),
      };
    }

    const recentMin = this.globalLog.filter(t => now - t < MINUTE_MS);
    if (recentMin.length >= this.maxPerMin) {
      return {
        limited: true,
        retryAfterSec: retryAfter(MINUTE_MS, now - recentMin[0]),
      };
    }

    const recentHr = this.globalLog.filter(t => now - t < HOUR_MS);
    if (recentHr.length >= this.maxPerHr) {
      return {
        limited: true,
        retryAfterSec: retryAfter(HOUR_MS, now - recentHr[0]),
      };
    }

    return { limited: false };
  }

  /** Record a hit against `key` at `now` and prune the global window. */
  record(key: string, now: number): void {
    this.lastByKey.set(key, now);
    this.globalLog.push(now);
    const cutoff = now - HOUR_MS;
    while (this.globalLog.length > 0 && this.globalLog[0] < cutoff) {
      this.globalLog.shift();
    }
  }
}
