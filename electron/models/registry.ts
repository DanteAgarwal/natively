// ---------------------------------------------------------------------------
// Model Registry — In-Memory Registry
// Singleton that holds all known models and provides lookup/filter methods.
//
// YAGNI: no persistence, no HTTP discovery, no scoring engine.
// The registry is seeded from static defaults and queried by services.
// ---------------------------------------------------------------------------

import {
  ModelRecord,
  ProviderId,
  Capability,
  InputModality,
  CostClass,
  ModelStatus,
  BillingMode,
  PrivacyMode,
  TaskProfile,
  RoutingRequest,
} from './types';
import { DEFAULT_MODEL_RECORDS } from './defaults';

/** Cost classes that are eligible under FREE_ONLY billing mode (PRD §6.2) */
const FREE_ELIGIBLE_COST_CLASSES: Set<CostClass> = new Set([
  'FREE_MODEL',
  'FREE_QUOTA',
  'LOCAL_ZERO_METER',
]);

/** Statuses that can auto-route (PRD §6.1 FR-06) */
const AUTO_ROUTE_STATUSES: Set<ModelStatus> = new Set([
  'verified',
]);

/**
 * Task profile → preferred capabilities mapping.
 * Used by getFallbackChain to prefer models that match the task.
 * This is a soft preference — hard filtering happens in getEligible().
 */
const TASK_PREFERRED_CAPABILITIES: Record<TaskProfile, Capability[]> = {
  fast_text: [],
  general: [],
  reasoning: ['reasoning'],
  coding: ['coding'],
  vision: ['vision'],
  transcription: ['transcription'],
  long_context: ['long_context'],
  json: ['json_schema'],
  local_private: [],
};

export class ModelRegistry {
  private models: ModelRecord[];

  constructor(seed?: ModelRecord[]) {
    this.models = [...(seed ?? DEFAULT_MODEL_RECORDS)];
  }

  // ─── Basic lookups ───────────────────────────────────────────────

  /** Returns all model records in the registry */
  getAll(): ModelRecord[] {
    return [...this.models];
  }

  /** Returns all models for a specific provider */
  getByProvider(providerId: ProviderId): ModelRecord[] {
    return this.models.filter((m) => m.providerId === providerId);
  }

  /** Returns a specific model by provider + model ID, or undefined */
  getById(providerId: ProviderId, modelId: string): ModelRecord | undefined {
    return this.models.find(
      (m) => m.providerId === providerId && m.modelId === modelId,
    );
  }

  /** Find a model by its modelId across all providers */
  findByModelId(modelId: string): ModelRecord | undefined {
    return this.models.find((m) => m.modelId === modelId);
  }

  // ─── Filtering ───────────────────────────────────────────────────

  /**
   * Returns models that are eligible to serve a routing request.
   * Applies hard filters in this order (PRD §8.1 steps 2-3):
   *   1. Status must be auto-routable (verified)
   *   2. Must have all required capabilities
   *   3. Must accept all required input modalities
   *   4. Must satisfy billing mode constraint
   *   5. Must satisfy privacy mode constraint
   */
  getEligible(request: RoutingRequest): ModelRecord[] {
    return this.models.filter((model) => {
      // 1. Status gate
      if (!AUTO_ROUTE_STATUSES.has(model.status)) return false;

      // 2. Capability check — model must have ALL required capabilities
      for (const cap of request.requiredCapabilities) {
        if (!model.capabilities.includes(cap)) return false;
      }

      // 3. Input modality check — model must accept ALL required modalities
      for (const mod of request.requiredInputModalities) {
        if (!model.inputModalities.includes(mod)) return false;
      }

      // 4. Billing mode constraint (FR-09: exclude paid before dispatch)
      if (request.billingMode === 'FREE_ONLY') {
        if (!FREE_ELIGIBLE_COST_CLASSES.has(model.costClass)) return false;
      }

      // 5. Privacy mode constraint (SEC-04: LOCAL_ONLY blocks cloud)
      if (request.privacyMode === 'LOCAL_ONLY') {
        if (model.costClass !== 'LOCAL_ZERO_METER') return false;
      }

      return true;
    });
  }

  /**
   * Returns an ordered fallback chain for a provider + task profile.
   * Verified models matching the task's preferred capabilities come first,
   * followed by other verified models from the same provider.
   * Deprecated/disabled models are excluded.
   */
  getFallbackChain(providerId: ProviderId, taskProfile: TaskProfile): ModelRecord[] {
    const providerModels = this.getByProvider(providerId).filter(
      (m) => AUTO_ROUTE_STATUSES.has(m.status),
    );

    const preferredCaps = TASK_PREFERRED_CAPABILITIES[taskProfile] || [];

    if (preferredCaps.length === 0) {
      return providerModels;
    }

    // Sort: models with preferred capabilities first
    return [...providerModels].sort((a, b) => {
      const aMatch = preferredCaps.filter((c) => a.capabilities.includes(c)).length;
      const bMatch = preferredCaps.filter((c) => b.capabilities.includes(c)).length;
      return bMatch - aMatch; // higher match count first
    });
  }

  // ─── Query helpers ────────────────────────────────────────────────

  /** Returns all verified models with a specific capability */
  getVerifiedWithCapability(capability: Capability): ModelRecord[] {
    return this.models.filter(
      (m) => m.status === 'verified' && m.capabilities.includes(capability),
    );
  }

  /** Returns all deprecated models (for UI warnings) */
  getDeprecated(): ModelRecord[] {
    return this.models.filter((m) => m.status === 'deprecated');
  }

  /** Returns all models eligible for free-only mode */
  getFreeModels(): ModelRecord[] {
    return this.models.filter(
      (m) => m.status === 'verified' && FREE_ELIGIBLE_COST_CLASSES.has(m.costClass),
    );
  }

  /** Returns all vision-capable, verified models */
  getVisionModels(): ModelRecord[] {
    return this.models.filter(
      (m) => m.status === 'verified' && m.inputModalities.includes('image'),
    );
  }

  /** Returns all transcription-capable, verified models */
  getTranscriptionModels(): ModelRecord[] {
    return this.models.filter(
      (m) => m.status === 'verified' && m.capabilities.includes('transcription'),
    );
  }

  // ─── Mutation (minimal — just status updates) ─────────────────────

  /**
   * Update a model's health status.
   * Returns true if the model was found and updated.
   */
  updateHealth(providerId: ProviderId, modelId: string, health: ModelRecord['health']): boolean {
    const model = this.getById(providerId, modelId);
    if (model) {
      model.health = health;
      return true;
    }
    return false;
  }

  /**
   * Update a model's lifecycle status.
   * Returns true if the model was found and updated.
   */
  updateStatus(providerId: ProviderId, modelId: string, status: ModelStatus): boolean {
    const model = this.getById(providerId, modelId);
    if (model) {
      model.status = status;
      return true;
    }
    return false;
  }
}

// ─── Singleton ──────────────────────────────────────────────────────

export const modelRegistry = new ModelRegistry();
