// ---------------------------------------------------------------------------
// Circuit Breaker — PRD §6.5 FR-26, FR-27
//
// State machine: CLOSED → OPEN → HALF_OPEN → CLOSED
//   CLOSED:    Normal operation; requests pass through.
//   OPEN:      All requests blocked; waiting for cooldown.
//   HALF_OPEN: Single probe request allowed to test recovery.
//
// Supports both provider-level and model-level circuits (FR-27).
// Uses exponential backoff with jitter for cooldown (FR-26).
// ---------------------------------------------------------------------------

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitBreakerConfig {
  /** Consecutive failures before opening circuit (FR-26: default 3) */
  failureThreshold: number;
  /** Initial cooldown before half-open (FR-26: default 60s) */
  cooldownMs: number;
  /** Maximum cooldown with exponential backoff */
  maxCooldownMs: number;
  /** Backoff multiplier per consecutive open */
  backoffMultiplier: number;
}

const DEFAULT_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 3,
  cooldownMs: 60_000,
  maxCooldownMs: 300_000,
  backoffMultiplier: 2,
};

export interface CircuitBreakerSnapshot {
  id: string;
  state: CircuitState;
  consecutiveFailures: number;
  lastFailureAt: number;
  openedAt: number;
  currentCooldownMs: number;
  lastSuccessAt: number;
}

export class CircuitBreaker {
  private state: CircuitState = 'CLOSED';
  private consecutiveFailures = 0;
  private lastFailureAt = 0;
  private lastSuccessAt = 0;
  private openedAt = 0;
  private currentCooldownMs: number;
  private openCount = 0; // tracks number of times circuit has opened (for backoff)

  constructor(
    public readonly id: string,
    private config: CircuitBreakerConfig = DEFAULT_CONFIG,
  ) {
    this.currentCooldownMs = config.cooldownMs;
  }

  // ─── State queries ───────────────────────────────────────────────

  getState(): CircuitState {
    // Check for automatic OPEN → HALF_OPEN transition
    if (this.state === 'OPEN' && this.shouldTransitionToHalfOpen()) {
      this.state = 'HALF_OPEN';
    }
    return this.state;
  }

  /**
   * Can a request attempt to go through this circuit?
   * - CLOSED: always yes
   * - HALF_OPEN: yes (single probe)
   * - OPEN: only if cooldown has elapsed (auto-transitions to HALF_OPEN)
   */
  canAttempt(): boolean {
    const state = this.getState(); // triggers auto-transition
    return state !== 'OPEN';
  }

  getConsecutiveFailures(): number {
    return this.consecutiveFailures;
  }

  getSnapshot(): CircuitBreakerSnapshot {
    return {
      id: this.id,
      state: this.getState(),
      consecutiveFailures: this.consecutiveFailures,
      lastFailureAt: this.lastFailureAt,
      openedAt: this.openedAt,
      currentCooldownMs: this.currentCooldownMs,
      lastSuccessAt: this.lastSuccessAt,
    };
  }

  // ─── State transitions ───────────────────────────────────────────

  /**
   * Record a successful request.
   * HALF_OPEN → CLOSED: probe succeeded, circuit recovered.
   * CLOSED: reset failure counter.
   */
  recordSuccess(): void {
    this.lastSuccessAt = Date.now();
    this.consecutiveFailures = 0;

    if (this.state === 'HALF_OPEN') {
      this.state = 'CLOSED';
      this.currentCooldownMs = this.config.cooldownMs; // reset backoff
      this.openCount = 0;
    }
  }

  /**
   * Record a failed request (transient failure only — caller decides).
   * CLOSED → OPEN: after threshold consecutive failures.
   * HALF_OPEN → OPEN: probe failed, increase cooldown.
   */
  recordFailure(): void {
    this.consecutiveFailures++;
    this.lastFailureAt = Date.now();

    if (this.state === 'HALF_OPEN') {
      // Probe failed — reopen with increased cooldown
      this.openCircuit();
      return;
    }

    if (this.state === 'CLOSED' && this.consecutiveFailures >= this.config.failureThreshold) {
      this.openCircuit();
    }
  }

  /**
   * Manually reset the circuit to CLOSED state.
   */
  reset(): void {
    this.state = 'CLOSED';
    this.consecutiveFailures = 0;
    this.openCount = 0;
    this.currentCooldownMs = this.config.cooldownMs;
  }

  // ─── Internal ────────────────────────────────────────────────────

  private openCircuit(): void {
    this.state = 'OPEN';
    this.openedAt = Date.now();
    this.openCount++;

    // Exponential backoff with jitter
    const baseDelay = this.config.cooldownMs * Math.pow(this.config.backoffMultiplier, this.openCount - 1);
    const jitter = Math.random() * 0.3 * baseDelay; // up to 30% jitter
    this.currentCooldownMs = Math.min(baseDelay + jitter, this.config.maxCooldownMs);
  }

  private shouldTransitionToHalfOpen(): boolean {
    return Date.now() - this.openedAt >= this.currentCooldownMs;
  }
}

// ---------------------------------------------------------------------------
// Circuit Breaker Manager — manages circuits for all providers/models
// Supports provider-level and model-level circuits (FR-27)
// ---------------------------------------------------------------------------

export class CircuitBreakerManager {
  private circuits = new Map<string, CircuitBreaker>();
  private config: CircuitBreakerConfig;

  constructor(config?: Partial<CircuitBreakerConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /** Get or create a circuit breaker for an identifier */
  private getOrCreate(id: string): CircuitBreaker {
    let cb = this.circuits.get(id);
    if (!cb) {
      cb = new CircuitBreaker(id, this.config);
      this.circuits.set(id, cb);
    }
    return cb;
  }

  /** Provider-level circuit key */
  private providerKey(providerId: string): string {
    return `provider:${providerId}`;
  }

  /** Model-level circuit key */
  private modelKey(providerId: string, modelId: string): string {
    return `model:${providerId}:${modelId}`;
  }

  // ─── Provider-level ──────────────────────────────────────────────

  canAttemptProvider(providerId: string): boolean {
    return this.getOrCreate(this.providerKey(providerId)).canAttempt();
  }

  recordProviderSuccess(providerId: string): void {
    this.getOrCreate(this.providerKey(providerId)).recordSuccess();
  }

  recordProviderFailure(providerId: string): void {
    this.getOrCreate(this.providerKey(providerId)).recordFailure();
  }

  getProviderState(providerId: string): CircuitState {
    return this.getOrCreate(this.providerKey(providerId)).getState();
  }

  // ─── Model-level ────────────────────────────────────────────────

  canAttemptModel(providerId: string, modelId: string): boolean {
    // Both provider and model circuits must allow
    return (
      this.canAttemptProvider(providerId) &&
      this.getOrCreate(this.modelKey(providerId, modelId)).canAttempt()
    );
  }

  recordModelSuccess(providerId: string, modelId: string): void {
    this.getOrCreate(this.modelKey(providerId, modelId)).recordSuccess();
    // A model success also counts for the provider
    this.recordProviderSuccess(providerId);
  }

  recordModelFailure(providerId: string, modelId: string): void {
    this.getOrCreate(this.modelKey(providerId, modelId)).recordFailure();
    // Don't auto-propagate to provider — provider circuit tracks its own failures
  }

  // ─── Management ─────────────────────────────────────────────────

  resetAll(): void {
    this.circuits.forEach((cb) => cb.reset());
  }

  resetProvider(providerId: string): void {
    const prefix = `provider:${providerId}`;
    const modelPrefix = `model:${providerId}:`;
    this.circuits.forEach((cb, key) => {
      if (key === prefix || key.startsWith(modelPrefix)) {
        cb.reset();
      }
    });
  }

  /** Get snapshots of all circuits for diagnostics */
  getAllSnapshots(): CircuitBreakerSnapshot[] {
    return Array.from(this.circuits.values()).map((cb) => cb.getSnapshot());
  }

  /** Get snapshots of circuits that are not CLOSED (for alerting) */
  getOpenCircuits(): CircuitBreakerSnapshot[] {
    return this.getAllSnapshots().filter((s) => s.state !== 'CLOSED');
  }
}

// ─── Singleton ──────────────────────────────────────────────────────

export const circuitBreakerManager = new CircuitBreakerManager();
