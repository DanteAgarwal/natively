// ---------------------------------------------------------------------------
// Quota Tracker — PRD §6.2 FR-11, FR-12
//
// Tracks estimated usage (requests, tokens) per provider and model against
// known limits. Uses sliding-window counters so the router can check
// headroom before dispatching.
//
// No external persistence — counters reset on app restart.
// ---------------------------------------------------------------------------

export interface QuotaLimits {
  rpm?: number;   // requests per minute
  rpd?: number;   // requests per day
  tpm?: number;   // tokens per minute
  tpd?: number;   // tokens per day
}

export interface QuotaSnapshot {
  id: string;
  limits: QuotaLimits;
  currentMinuteRequests: number;
  currentDayRequests: number;
  currentMinuteTokens: number;
  currentDayTokens: number;
  headroom: QuotaHeadroom;
}

export interface QuotaHeadroom {
  /** 0.0 = exhausted, 1.0 = fully available */
  requestMinuteRatio: number;
  requestDayRatio: number;
  tokenMinuteRatio: number;
  tokenDayRatio: number;
  /** Minimum of all ratios — overall health */
  overall: number;
}

interface TimestampedCount {
  timestamp: number;
  count: number;
}

/**
 * Sliding-window counter for a single time window.
 * Tracks counts in buckets and sums over the window.
 */
class SlidingWindow {
  private buckets: TimestampedCount[] = [];
  private windowMs: number;

  constructor(windowMs: number) {
    this.windowMs = windowMs;
  }

  add(count: number): void {
    this.prune();
    this.buckets.push({ timestamp: Date.now(), count });
  }

  getTotal(): number {
    this.prune();
    return this.buckets.reduce((sum, b) => sum + b.count, 0);
  }

  private prune(): void {
    const cutoff = Date.now() - this.windowMs;
    this.buckets = this.buckets.filter((b) => b.timestamp > cutoff);
  }
}

const ONE_MINUTE = 60_000;
const ONE_DAY = 86_400_000;

/**
 * Quota counter for a single provider or model.
 */
class QuotaCounter {
  private minuteRequests = new SlidingWindow(ONE_MINUTE);
  private dayRequests = new SlidingWindow(ONE_DAY);
  private minuteTokens = new SlidingWindow(ONE_MINUTE);
  private dayTokens = new SlidingWindow(ONE_DAY);

  constructor(
    public readonly id: string,
    public limits: QuotaLimits,
  ) {}

  recordRequest(tokenCount: number = 0): void {
    this.minuteRequests.add(1);
    this.dayRequests.add(1);
    if (tokenCount > 0) {
      this.minuteTokens.add(tokenCount);
      this.dayTokens.add(tokenCount);
    }
  }

  getHeadroom(): QuotaHeadroom {
    const minuteReqs = this.minuteRequests.getTotal();
    const dayReqs = this.dayRequests.getTotal();
    const minuteToks = this.minuteTokens.getTotal();
    const dayToks = this.dayTokens.getTotal();

    const ratio = (used: number, limit: number | undefined): number => {
      if (limit === undefined || limit <= 0) return 1.0; // no limit = full headroom
      return Math.max(0, 1 - used / limit);
    };

    const requestMinuteRatio = ratio(minuteReqs, this.limits.rpm);
    const requestDayRatio = ratio(dayReqs, this.limits.rpd);
    const tokenMinuteRatio = ratio(minuteToks, this.limits.tpm);
    const tokenDayRatio = ratio(dayToks, this.limits.tpd);

    return {
      requestMinuteRatio,
      requestDayRatio,
      tokenMinuteRatio,
      tokenDayRatio,
      overall: Math.min(requestMinuteRatio, requestDayRatio, tokenMinuteRatio, tokenDayRatio),
    };
  }

  getSnapshot(): QuotaSnapshot {
    return {
      id: this.id,
      limits: { ...this.limits },
      currentMinuteRequests: this.minuteRequests.getTotal(),
      currentDayRequests: this.dayRequests.getTotal(),
      currentMinuteTokens: this.minuteTokens.getTotal(),
      currentDayTokens: this.dayTokens.getTotal(),
      headroom: this.getHeadroom(),
    };
  }
}

// ---------------------------------------------------------------------------
// Hard Cap Configuration — PRD §6.2 FR-12
// ---------------------------------------------------------------------------

export interface HardCaps {
  maxRequestsPerProviderPerDay?: number;
  maxTokensPerRequest?: number;
  maxOutputTokens?: number;
  maxConcurrentRequests?: number;
  maxFallbackAttempts?: number;
}

const DEFAULT_HARD_CAPS: HardCaps = {
  maxRequestsPerProviderPerDay: undefined, // no limit by default
  maxTokensPerRequest: undefined,
  maxOutputTokens: undefined,
  maxConcurrentRequests: undefined,
  maxFallbackAttempts: 2, // FR-23: at most 2 provider switches
};

// ---------------------------------------------------------------------------
// Quota Tracker — manages quotas for all providers/models
// ---------------------------------------------------------------------------

export class QuotaTracker {
  private counters = new Map<string, QuotaCounter>();
  private hardCaps: HardCaps;

  constructor(hardCaps?: Partial<HardCaps>) {
    this.hardCaps = { ...DEFAULT_HARD_CAPS, ...hardCaps };
  }

  /** Register or update quota limits for a provider or model */
  setLimits(id: string, limits: QuotaLimits): void {
    const existing = this.counters.get(id);
    if (existing) {
      existing.limits = limits;
    } else {
      this.counters.set(id, new QuotaCounter(id, limits));
    }
  }

  /** Record a completed request */
  recordUsage(id: string, tokenCount: number = 0): void {
    let counter = this.counters.get(id);
    if (!counter) {
      counter = new QuotaCounter(id, {});
      this.counters.set(id, counter);
    }
    counter.recordRequest(tokenCount);
  }

  /** Get headroom for a specific id */
  getHeadroom(id: string): QuotaHeadroom {
    const counter = this.counters.get(id);
    if (!counter) {
      return { requestMinuteRatio: 1, requestDayRatio: 1, tokenMinuteRatio: 1, tokenDayRatio: 1, overall: 1 };
    }
    return counter.getHeadroom();
  }

  /** Check if we have any headroom left (overall > 0) */
  hasHeadroom(id: string): boolean {
    return this.getHeadroom(id).overall > 0;
  }

  /** Check hard caps before dispatch */
  checkHardCaps(providerId: string, estimatedTokens?: number): HardCapViolation | null {
    const headroom = this.getHeadroom(`provider:${providerId}`);

    if (this.hardCaps.maxRequestsPerProviderPerDay !== undefined) {
      const counter = this.counters.get(`provider:${providerId}`);
      if (counter) {
        const snap = counter.getSnapshot();
        if (snap.currentDayRequests >= this.hardCaps.maxRequestsPerProviderPerDay) {
          return { type: 'MAX_REQUESTS_PER_DAY', limit: this.hardCaps.maxRequestsPerProviderPerDay };
        }
      }
    }

    if (estimatedTokens !== undefined && this.hardCaps.maxTokensPerRequest !== undefined) {
      if (estimatedTokens > this.hardCaps.maxTokensPerRequest) {
        return { type: 'MAX_TOKENS_PER_REQUEST', limit: this.hardCaps.maxTokensPerRequest };
      }
    }

    return null;
  }

  getHardCaps(): HardCaps {
    return { ...this.hardCaps };
  }

  /** Get all quota snapshots for diagnostics */
  getAllSnapshots(): QuotaSnapshot[] {
    return Array.from(this.counters.values()).map((c) => c.getSnapshot());
  }

  /** Get quotas that are nearly exhausted (headroom < threshold) */
  getNearlyExhausted(threshold: number = 0.1): QuotaSnapshot[] {
    return this.getAllSnapshots().filter((s) => s.headroom.overall < threshold);
  }
}

export interface HardCapViolation {
  type: 'MAX_REQUESTS_PER_DAY' | 'MAX_TOKENS_PER_REQUEST' | 'MAX_OUTPUT_TOKENS';
  limit: number;
}

// ─── Singleton ──────────────────────────────────────────────────────

export const quotaTracker = new QuotaTracker();
