import { SlidingWindowRateLimiter } from './rateLimiter';

const T0 = 1_000_000; // fixed base epoch (Date.now not used — time is injected)

describe('SlidingWindowRateLimiter', () => {
  describe('per-key cooldown', () => {
    it('blocks a repeat hit for the same key inside the cooldown window', () => {
      const rl = new SlidingWindowRateLimiter(30_000, 100, 100);
      expect(rl.check('a', T0).limited).toBe(false);
      rl.record('a', T0);

      const decision = rl.check('a', T0 + 10_000);
      // Narrow before asserting: a conditional `expect` would silently pass
      // if the decision came back unlimited.
      if (!decision.limited) throw new Error('expected the hit to be limited');
      expect(decision.retryAfterSec).toBe(20);
    });

    it('allows the same key again once the cooldown has elapsed', () => {
      const rl = new SlidingWindowRateLimiter(30_000, 100, 100);
      rl.record('a', T0);
      expect(rl.check('a', T0 + 30_000).limited).toBe(false);
    });

    it('does not block a different key during another key’s cooldown', () => {
      const rl = new SlidingWindowRateLimiter(30_000, 100, 100);
      rl.record('a', T0);
      expect(rl.check('b', T0 + 1).limited).toBe(false);
    });
  });

  describe('global per-minute cap', () => {
    it('blocks once maxPerMin distinct hits occur within a minute', () => {
      const rl = new SlidingWindowRateLimiter(0, 3, 100);
      rl.record('a', T0);
      rl.record('b', T0 + 1);
      rl.record('c', T0 + 2);

      const decision = rl.check('d', T0 + 3);
      expect(decision.limited).toBe(true);
    });

    it('recovers after the minute window slides past the oldest hit', () => {
      const rl = new SlidingWindowRateLimiter(0, 3, 100);
      rl.record('a', T0);
      rl.record('b', T0 + 1);
      rl.record('c', T0 + 2);
      // 60s after the first hit, the minute window no longer counts it.
      expect(rl.check('d', T0 + 60_000).limited).toBe(false);
    });
  });

  describe('global per-hour cap', () => {
    it('blocks once maxPerHr hits occur within an hour', () => {
      const rl = new SlidingWindowRateLimiter(0, 100, 2);
      rl.record('a', T0);
      rl.record('b', T0 + 1);
      expect(rl.check('c', T0 + 2).limited).toBe(true);
    });
  });

  describe('record() prunes the global log', () => {
    it('keeps memory bounded by dropping hits older than one hour', () => {
      const rl = new SlidingWindowRateLimiter(0, 1000, 1000);
      rl.record('a', T0);
      // A hit >1h later prunes the stale entry, so the hour window is clear.
      rl.record('b', T0 + 3_600_001);
      expect(rl.check('c', T0 + 3_600_002).limited).toBe(false);
    });
  });
});
