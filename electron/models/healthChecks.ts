// ---------------------------------------------------------------------------
// Model Registry — Health Checks & Probing
// PRD §6.1 FR-06, FR-07, §6.8 FR-41, §6.9 FR-50
//
// Performs non-sensitive health probes, capability smoke tests,
// tracks probe metrics (last check, failure count, latency), and runs
// deprecation review checks.
// ---------------------------------------------------------------------------

import {
  ModelRecord,
  ProviderId,
  ModelHealth,
  Capability,
} from './types';
import { ModelRegistry, modelRegistry } from './registry';

export interface ProbeResult {
  ok: boolean;
  latencyMs: number;
  testedCapability: Capability | 'basic_ping';
  error?: string;
  statusCode?: number;
  timestamp: number;
}

export interface ModelHealthTelemetry {
  providerId: ProviderId;
  modelId: string;
  health: ModelHealth;
  lastSuccessfulProbeAt?: number;
  lastFailureAt?: number;
  consecutiveFailures: number;
  lastFailureReason?: string;
  measuredLatencyMs?: number;
}

// 1x1 transparent PNG base64 for safe vision probe
export const TINY_TEST_IMAGE_BASE64 =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

// Minimal test prompts per capability (non-sensitive, deterministic)
export const PROBE_PAYLOADS = {
  ping: 'Return only the word OK.',
  json: 'Return a JSON object with key "status" and value "ok".',
  vision: 'What is this image? Reply in 3 words.',
};

/**
 * Health Check & Probe Manager
 */
export class HealthCheckManager {
  private healthData = new Map<string, ModelHealthTelemetry>();

  constructor(private registry: ModelRegistry = modelRegistry) {}

  private getKey(providerId: ProviderId, modelId: string): string {
    return `${providerId}:${modelId}`;
  }

  /**
   * Get telemetry for a specific model
   */
  getTelemetry(providerId: ProviderId, modelId: string): ModelHealthTelemetry {
    const key = this.getKey(providerId, modelId);
    let record = this.healthData.get(key);
    if (!record) {
      const model = this.registry.getById(providerId, modelId);
      record = {
        providerId,
        modelId,
        health: model ? model.health : 'unknown',
        consecutiveFailures: 0,
      };
      this.healthData.set(key, record);
    }
    return record;
  }

  /**
   * Record a probe result and update model health in registry
   */
  recordProbeResult(providerId: ProviderId, modelId: string, result: ProbeResult): void {
    const telemetry = this.getTelemetry(providerId, modelId);

    if (result.ok) {
      telemetry.health = 'healthy';
      telemetry.lastSuccessfulProbeAt = result.timestamp;
      telemetry.consecutiveFailures = 0;
      telemetry.measuredLatencyMs = result.latencyMs;
      telemetry.lastFailureReason = undefined;
    } else {
      telemetry.consecutiveFailures += 1;
      telemetry.lastFailureAt = result.timestamp;
      telemetry.lastFailureReason = result.error || 'Probe failed';
      // If 3+ consecutive failures, mark degraded or down
      if (telemetry.consecutiveFailures >= 3) {
        telemetry.health = 'down';
      } else {
        telemetry.health = 'degraded';
      }
    }

    // Reflect to registry
    this.registry.updateHealth(providerId, modelId, telemetry.health);
  }

  /**
   * Run deprecation review across all registered models (FR-50)
   * Flags models known to be deprecated or shutting down.
   */
  runDeprecationReview(): Array<{ model: ModelRecord; reason: string }> {
    const deprecated = this.registry.getDeprecated();
    return deprecated.map((m) => ({
      model: m,
      reason: m.deprecationNote || 'Model has been flagged as deprecated.',
    }));
  }

  /**
   * Get all active telemetry snapshots
   */
  getAllTelemetry(): ModelHealthTelemetry[] {
    return Array.from(this.healthData.values());
  }
}

// ─── Singleton ─────────────────────────────────────────────────────────────

export const healthCheckManager = new HealthCheckManager();
