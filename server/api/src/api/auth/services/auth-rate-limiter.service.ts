import { Injectable } from '@nestjs/common';

interface Window {
  count: number;
  resetAt: number;
}

export interface RateLimitRule {
  key: string;
  limit: number;
}

/**
 * Fixed-window attempt counter, kept in memory. Each api instance counts on its own,
 * which is enough to slow down password guessing against one server.
 */
@Injectable()
export class AuthRateLimiter {
  private windows = new Map<string, Window>();
  private nextSweepAt = 0;

  /**
   * Counts one attempt against every rule. Returns 0 when all rules are within their limit,
   * otherwise the seconds until the attempt can be retried.
   */
  hit(rules: RateLimitRule[], windowMs: number, now = Date.now()): number {
    this.sweepExpired(now, windowMs);

    let retryAfterMs = 0;
    for (const { key, limit } of rules) {
      let window = this.windows.get(key);
      if (!window || window.resetAt <= now) {
        window = { count: 0, resetAt: now + windowMs };
        this.windows.set(key, window);
      }
      window.count += 1;
      if (window.count > limit) {
        retryAfterMs = Math.max(retryAfterMs, window.resetAt - now);
      }
    }
    return Math.ceil(retryAfterMs / 1000);
  }

  /** Drops finished windows at most once per window, so the map doesn't grow forever. */
  private sweepExpired(now: number, windowMs: number) {
    if (now < this.nextSweepAt) {
      return;
    }
    for (const [key, window] of this.windows) {
      if (window.resetAt <= now) {
        this.windows.delete(key);
      }
    }
    this.nextSweepAt = now + windowMs;
  }
}
