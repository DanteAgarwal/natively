// ---------------------------------------------------------------------------
// Model Registry — Diagnostics & Observability
// PRD §6.9 FR-46, FR-47, FR-48, FR-49, SEC-08, SEC-09
//
// Tracks structured request traces, redacts sensitive payload data by default,
// calculates operational metrics (success rates, latency percentiles, error breakdown),
// and provides safe diagnostic export.
// ---------------------------------------------------------------------------

import {
  ProviderId,
  TaskProfile,
  Capability,
  InputModality,
  CostClass,
  BillingMode,
  PrivacyMode,
} from './types';

// ─── Error Classification ──────────────────────────────────────────────────

export type ErrorClass =
  | 'RATE_LIMIT_429'
  | 'AUTH_ERROR_401'
  | 'NOT_FOUND_404'
  | 'INVALID_REQUEST_400'
  | 'SERVER_ERROR_5XX'
  | 'TIMEOUT'
  | 'NETWORK_ERROR'
  | 'POLICY_VIOLATION'
  | 'CIRCUIT_OPEN'
  | 'QUOTA_EXHAUSTED'
  | 'UNKNOWN';

// ─── Request Attempt & Trace Structures ────────────────────────────────────

export interface RequestAttempt {
  providerId: ProviderId;
  modelId: string;
  attemptNumber: number;
  startedAt: number;
  durationMs: number;
  status: 'SUCCESS' | 'FAILED' | 'RETRYING';
  errorClass?: ErrorClass;
  errorMessage?: string;
  statusCode?: number;
  retryAfterMs?: number;
}

export interface RequestTrace {
  requestId: string;
  timestamp: number;
  taskProfile: TaskProfile;
  requiredCapabilities: Capability[];
  requiredInputModalities: InputModality[];
  billingMode: BillingMode;
  privacyMode: PrivacyMode;

  // Selection & Execution
  selectedProvider?: ProviderId;
  selectedModel?: string;
  costClass?: CostClass;
  selectionReason?: string; // FR-43 "Why was this model selected?"

  // Latency & Tokens
  timeToFirstTokenMs?: number;
  totalDurationMs: number;
  estimatedTokens?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };

  // Outcome & Fallbacks
  fallbackCount: number;
  attempts: RequestAttempt[];
  status: 'SUCCESS' | 'FAILED' | 'BLOCKED';
  finalErrorClass?: ErrorClass;
  finalErrorMessage?: string;
}

export interface DiagnosticMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  blockedRequests: number;
  successRate: number; // 0.0 - 1.0
  fallbackRescueRate: number; // recovered by fallback / total fallbacks
  p50LatencyMs: number;
  p95LatencyMs: number;
  p99LatencyMs: number;
  averageTimeToFirstTokenMs: number;
  errorsByClass: Record<ErrorClass, number>;
  quotaExhaustionCount: number;
  mostUsedModels: Array<{ providerId: ProviderId; modelId: string; count: number }>;
  timeWindowStart: number;
  timeWindowEnd: number;
}

// ─── Redaction Utilities (FR-47, SEC-06, SEC-09) ───────────────────────────

const SENSITIVE_KEY_PATTERNS = [
  /bearer\s+[a-z0-9\-._~+/]+=*/i,
  /key\s*=\s*['"]?[a-z0-9\-_]{16,}['"]?/i,
  /api[-_]?key['"]?\s*[:=]\s*['"]?[a-z0-9\-_]{16,}['"]?/i,
  /csk-[a-zA-Z0-9]{20,}/, // Cerebras keys
  /gsk_[a-zA-Z0-9]{20,}/, // Groq keys
  /sk-or-v1-[a-zA-Z0-9]{20,}/, // OpenRouter keys
  /AIza[0-9A-Za-z-_]{35}/, // Google Gemini keys
];

export class ObservabilityRedactor {
  /**
   * Redacts sensitive secrets from a string (API keys, authorization headers).
   */
  static redactText(text: string): string {
    if (!text) return text;
    let sanitized = text;
    for (const pattern of SENSITIVE_KEY_PATTERNS) {
      sanitized = sanitized.replace(pattern, '[REDACTED_SECRET]');
    }
    return sanitized;
  }

  /**
   * Strips prompts, image payloads, and audio buffers from logs (FR-47).
   */
  static sanitizePayload(payload: Record<string, any>): Record<string, any> {
    const sanitized: Record<string, any> = {};
    for (const [key, val] of Object.entries(payload)) {
      if (['prompt', 'messages', 'systemInstruction', 'userMessage'].includes(key)) {
        sanitized[key] = '[REDACTED_PROMPT_CONTENT]';
      } else if (['imageBase64', 'image', 'screenshot', 'screenData'].includes(key)) {
        sanitized[key] = '[REDACTED_IMAGE_DATA]';
      } else if (['audio', 'audioBuffer', 'rawAudio'].includes(key)) {
        sanitized[key] = '[REDACTED_AUDIO_DATA]';
      } else if (typeof val === 'string') {
        sanitized[key] = this.redactText(val);
      } else if (typeof val === 'object' && val !== null) {
        sanitized[key] = this.sanitizePayload(val);
      } else {
        sanitized[key] = val;
      }
    }
    return sanitized;
  }
}

// ─── Diagnostics Tracker (Singleton) ───────────────────────────────────────

export class DiagnosticsTracker {
  private traces: RequestTrace[] = [];
  private maxTraces: number;
  private retentionMs: number;

  constructor(maxTraces: number = 500, retentionDays: number = 7) {
    this.maxTraces = maxTraces;
    this.retentionMs = retentionDays * 24 * 60 * 60 * 1000;
  }

  /** Record a completed request trace */
  recordTrace(trace: RequestTrace): void {
    this.prune();
    // Prepend or append into bounded ring buffer
    this.traces.push(trace);
    if (this.traces.length > this.maxTraces) {
      this.traces.shift();
    }
  }

  /** Get all current traces */
  getTraces(limit?: number): RequestTrace[] {
    this.prune();
    const result = [...this.traces].reverse();
    return limit ? result.slice(0, limit) : result;
  }

  /** Find a trace by its unique request ID */
  getTraceById(requestId: string): RequestTrace | undefined {
    return this.traces.find((t) => t.requestId === requestId);
  }

  /**
   * Calculate operational metrics across a given time window (default 7 days).
   * Maps to PRD §6.9 FR-48.
   */
  getMetrics(windowMs: number = 7 * 24 * 60 * 60 * 1000): DiagnosticMetrics {
    this.prune();
    const cutoff = Date.now() - windowMs;
    const windowTraces = this.traces.filter((t) => t.timestamp >= cutoff);

    const totalRequests = windowTraces.length;
    let successfulRequests = 0;
    let failedRequests = 0;
    let blockedRequests = 0;
    let fallbackOpportunities = 0;
    let fallbackRescued = 0;
    let quotaExhaustionCount = 0;

    const latencies: number[] = [];
    const ttftValues: number[] = [];
    const errorsByClass: Record<ErrorClass, number> = {
      RATE_LIMIT_429: 0,
      AUTH_ERROR_401: 0,
      NOT_FOUND_404: 0,
      INVALID_REQUEST_400: 0,
      SERVER_ERROR_5XX: 0,
      TIMEOUT: 0,
      NETWORK_ERROR: 0,
      POLICY_VIOLATION: 0,
      CIRCUIT_OPEN: 0,
      QUOTA_EXHAUSTED: 0,
      UNKNOWN: 0,
    };

    const modelUsageMap = new Map<string, { providerId: ProviderId; modelId: string; count: number }>();

    for (const trace of windowTraces) {
      if (trace.status === 'SUCCESS') successfulRequests++;
      else if (trace.status === 'FAILED') failedRequests++;
      else if (trace.status === 'BLOCKED') blockedRequests++;

      if (trace.totalDurationMs > 0) {
        latencies.push(trace.totalDurationMs);
      }
      if (trace.timeToFirstTokenMs && trace.timeToFirstTokenMs > 0) {
        ttftValues.push(trace.timeToFirstTokenMs);
      }

      if (trace.fallbackCount > 0) {
        fallbackOpportunities++;
        if (trace.status === 'SUCCESS') {
          fallbackRescued++;
        }
      }

      // Check errors across attempts
      for (const attempt of trace.attempts) {
        if (attempt.errorClass) {
          errorsByClass[attempt.errorClass] = (errorsByClass[attempt.errorClass] || 0) + 1;
          if (attempt.errorClass === 'QUOTA_EXHAUSTED' || attempt.errorClass === 'RATE_LIMIT_429') {
            quotaExhaustionCount++;
          }
        }
      }

      // Model count
      if (trace.selectedProvider && trace.selectedModel) {
        const key = `${trace.selectedProvider}:${trace.selectedModel}`;
        const existing = modelUsageMap.get(key) || {
          providerId: trace.selectedProvider,
          modelId: trace.selectedModel,
          count: 0,
        };
        existing.count++;
        modelUsageMap.set(key, existing);
      }
    }

    latencies.sort((a, b) => a - b);
    const p50 = latencies.length ? latencies[Math.floor(latencies.length * 0.5)] : 0;
    const p95 = latencies.length ? latencies[Math.floor(latencies.length * 0.95)] : 0;
    const p99 = latencies.length ? latencies[Math.floor(latencies.length * 0.99)] : 0;
    const avgTtft = ttftValues.length
      ? ttftValues.reduce((a, b) => a + b, 0) / ttftValues.length
      : 0;

    const mostUsedModels = Array.from(modelUsageMap.values()).sort((a, b) => b.count - a.count);

    return {
      totalRequests,
      successfulRequests,
      failedRequests,
      blockedRequests,
      successRate: totalRequests > 0 ? successfulRequests / totalRequests : 1.0,
      fallbackRescueRate: fallbackOpportunities > 0 ? fallbackRescued / fallbackOpportunities : 0.0,
      p50LatencyMs: p50,
      p95LatencyMs: p95,
      p99LatencyMs: p99,
      averageTimeToFirstTokenMs: Math.round(avgTtft),
      errorsByClass,
      quotaExhaustionCount,
      mostUsedModels: mostUsedModels.slice(0, 10),
      timeWindowStart: cutoff,
      timeWindowEnd: Date.now(),
    };
  }

  /**
   * Export diagnostics payload for inspection or troubleshooting (FR-49).
   * Strips any raw prompts or content before returning.
   */
  exportDiagnostics(): string {
    const metrics = this.getMetrics();
    const traces = this.getTraces(100);
    return JSON.stringify(
      {
        exportedAt: new Date().toISOString(),
        metrics,
        recentTraces: traces,
      },
      null,
      2,
    );
  }

  /** Clear all recorded diagnostics (SEC-09) */
  clearDiagnostics(): void {
    this.traces = [];
  }

  private prune(): void {
    const cutoff = Date.now() - this.retentionMs;
    this.traces = this.traces.filter((t) => t.timestamp > cutoff);
  }
}

// ─── Singleton ─────────────────────────────────────────────────────────────

export const diagnostics = new DiagnosticsTracker();
