// ---------------------------------------------------------------------------
// Model Registry — Provider Catalog Sync & Discovery
// PRD §6.1 FR-02, FR-03, FR-04, FR-05, FR-06, FR-07, §6.8 FR-44
//
// Polls provider catalogs, normalizes entries into canonical ModelRecord schema,
// computes diffs, places newly discovered models into the 'candidate' review queue,
// and protects production auto-routing from unverified discoveries.
// ---------------------------------------------------------------------------

import {
  ModelRecord,
  ProviderId,
  CostClass,
  Capability,
  InputModality,
  OutputModality,
} from './types';
import { ModelRegistry, modelRegistry } from './registry';

export interface CatalogDiff {
  providerId: ProviderId;
  syncTimestamp: number;
  added: ModelRecord[];
  removed: string[]; // model IDs removed from catalog
  changed: Array<{
    modelId: string;
    field: string;
    oldValue: any;
    newValue: any;
  }>;
}

export interface CatalogSyncStatus {
  providerId: ProviderId;
  lastSyncAt?: number;
  lastSyncStatus: 'SUCCESS' | 'FAILED' | 'NEVER';
  lastError?: string;
  totalModelsFound: number;
}

export class ModelCatalogSync {
  private syncStatuses = new Map<ProviderId, CatalogSyncStatus>();
  private diffHistory: CatalogDiff[] = [];
  private candidateQueue: ModelRecord[] = [];

  constructor(private registry: ModelRegistry = modelRegistry) {
    const providers: ProviderId[] = ['gemini', 'groq', 'openrouter', 'ollama', 'router', 'cloudflare', 'huggingface'];
    for (const p of providers) {
      this.syncStatuses.set(p, {
        providerId: p,
        lastSyncStatus: 'NEVER',
        totalModelsFound: 0,
      });
    }
  }

  /**
   * Normalize an OpenRouter raw catalog model into canonical ModelRecord.
   * Maps to PRD §7.1 and §8.2.
   */
  normalizeOpenRouterModel(raw: any): ModelRecord {
    const modelId = String(raw.id || '');
    const displayName = String(raw.name || modelId);
    const contextWindow = Number(raw.context_length) || 4096;

    // Modalities inference
    const inputModalities: InputModality[] = ['text'];
    const outputModalities: OutputModality[] = ['text'];
    const architecture = raw.architecture || {};
    const modalityStr = (architecture.modality || '').toLowerCase();

    if (modalityStr.includes('image') || modalityStr.includes('multimodal')) {
      inputModalities.push('image');
    }
    if (modalityStr.includes('audio')) {
      inputModalities.push('audio');
    }

    // Cost classification (PRD §6.2)
    // OpenRouter has pricing: { prompt: "0", completion: "0" }
    const pricing = raw.pricing || {};
    const promptPrice = parseFloat(pricing.prompt || '1');
    const completionPrice = parseFloat(pricing.completion || '1');
    const isZeroPrice = promptPrice === 0 && completionPrice === 0;
    const isFreeSuffix = modelId.endsWith(':free');

    let costClass: CostClass = 'PAID';
    if (isZeroPrice || isFreeSuffix) {
      costClass = 'FREE_MODEL';
    } else if (promptPrice > 0 || completionPrice > 0) {
      costClass = 'PAID';
    } else {
      costClass = 'UNKNOWN';
    }

    // Capability inference
    const capabilities: Capability[] = [];
    const lowerId = modelId.toLowerCase();
    const lowerDesc = (raw.description || '').toLowerCase();

    if (lowerId.includes('code') || lowerDesc.includes('coding') || lowerDesc.includes('programming')) {
      capabilities.push('coding');
    }
    if (lowerId.includes('instruct') || lowerDesc.includes('reasoning') || lowerDesc.includes('reason')) {
      capabilities.push('reasoning');
    }
    if (inputModalities.includes('image')) {
      capabilities.push('vision');
    }
    if (contextWindow >= 100_000) {
      capabilities.push('long_context');
    }
    if (raw.supported_parameters?.includes('tools') || lowerDesc.includes('tool')) {
      capabilities.push('tools');
    }
    if (raw.supported_parameters?.includes('response_format') || lowerDesc.includes('json')) {
      capabilities.push('json_schema');
    }

    return {
      providerId: 'openrouter',
      modelId,
      displayName,
      status: 'candidate', // Discovered models start as 'candidate' (FR-06)
      inputModalities,
      outputModalities,
      capabilities,
      costClass,
      contextWindow,
      health: 'unknown',
      pricingEvidenceUrl: 'https://openrouter.ai/models',
      dataUseNote: raw.description ? 'Subject to OpenRouter and model provider terms.' : undefined,
    };
  }

  /**
   * Normalize a Groq raw catalog model into canonical ModelRecord.
   */
  normalizeGroqModel(raw: any): ModelRecord {
    const modelId = String(raw.id || '');
    const contextWindow = Number(raw.context_window) || 8192;
    const isWhisper = modelId.includes('whisper');

    const inputModalities: InputModality[] = isWhisper ? ['audio'] : ['text'];
    const outputModalities: OutputModality[] = ['text'];
    const capabilities: Capability[] = [];

    if (isWhisper) {
      capabilities.push('transcription');
    } else {
      if (modelId.includes('70b') || modelId.includes('120b') || modelId.includes('r1')) {
        capabilities.push('reasoning');
      }
      if (modelId.includes('code') || modelId.includes('oss')) {
        capabilities.push('coding');
      }
      if (contextWindow >= 64_000) {
        capabilities.push('long_context');
      }
      capabilities.push('tools', 'json_schema');
    }

    // Check deprecation per PRD §7.2
    const isDeprecated =
      modelId.includes('llama-3.3-70b-versatile') ||
      modelId.includes('llama-3.1-8b-instant');

    return {
      providerId: 'groq',
      modelId,
      displayName: `Groq ${modelId}`,
      status: isDeprecated ? 'deprecated' : 'candidate',
      inputModalities,
      outputModalities,
      capabilities,
      costClass: 'FREE_QUOTA', // Groq developer free tier
      contextWindow,
      health: 'unknown',
      pricingEvidenceUrl: 'https://groq.com/pricing',
      deprecationNote: isDeprecated ? 'Decommissioned on Groq developer free tier.' : undefined,
    };
  }

  /**
   * Process discovered models for a provider, detect diffs,
   * and place new models into the candidate queue (FR-05, FR-06).
   */
  processDiscoveredModels(providerId: ProviderId, discovered: ModelRecord[]): CatalogDiff {
    const now = Date.now();
    const existing = this.registry.getByProvider(providerId);
    const existingMap = new Map(existing.map((m) => [m.modelId, m]));

    const added: ModelRecord[] = [];
    const removed: string[] = [];
    const changed: Array<{ modelId: string; field: string; oldValue: any; newValue: any }> = [];

    const discoveredIds = new Set(discovered.map((d) => d.modelId));

    for (const d of discovered) {
      const match = existingMap.get(d.modelId);
      if (!match) {
        // Brand new model discovered
        added.push(d);
        this.candidateQueue.push(d);
      } else {
        // Check for field changes (e.g. context limit, cost class)
        if (match.contextWindow !== d.contextWindow) {
          changed.push({
            modelId: d.modelId,
            field: 'contextWindow',
            oldValue: match.contextWindow,
            newValue: d.contextWindow,
          });
          match.contextWindow = d.contextWindow;
        }
        if (match.costClass !== d.costClass) {
          changed.push({
            modelId: d.modelId,
            field: 'costClass',
            oldValue: match.costClass,
            newValue: d.costClass,
          });
          match.costClass = d.costClass;
        }
      }
    }

    // Check for removed models
    for (const ex of existing) {
      if (!discoveredIds.has(ex.modelId)) {
        removed.push(ex.modelId);
      }
    }

    const diff: CatalogDiff = {
      providerId,
      syncTimestamp: now,
      added,
      removed,
      changed,
    };

    this.diffHistory.push(diff);

    // Update status
    this.syncStatuses.set(providerId, {
      providerId,
      lastSyncAt: now,
      lastSyncStatus: 'SUCCESS',
      totalModelsFound: discovered.length,
    });

    return diff;
  }

  // ─── Candidate Review Queue (FR-44) ──────────────────────────────────────

  /** Get all models awaiting review/approval */
  getCandidates(): ModelRecord[] {
    return [...this.candidateQueue];
  }

  /** Approve a candidate model to enter the active registry with verified status */
  approveCandidate(modelId: string): boolean {
    const index = this.candidateQueue.findIndex((m) => m.modelId === modelId);
    if (index === -1) return false;

    const [candidate] = this.candidateQueue.splice(index, 1);
    candidate.status = 'verified';
    // Add or update in registry
    const existing = this.registry.getById(candidate.providerId, candidate.modelId);
    if (existing) {
      existing.status = 'verified';
    } else {
      // In-memory model addition
      (this.registry as any).models.push(candidate);
    }
    return true;
  }

  /** Reject or disable a candidate model */
  rejectCandidate(modelId: string): boolean {
    const index = this.candidateQueue.findIndex((m) => m.modelId === modelId);
    if (index === -1) return false;
    this.candidateQueue.splice(index, 1);
    return true;
  }

  /** Get status of all catalog sync jobs */
  getAllSyncStatuses(): CatalogSyncStatus[] {
    return Array.from(this.syncStatuses.values());
  }

  /** Get recorded diff history */
  getDiffHistory(): CatalogDiff[] {
    return [...this.diffHistory];
  }
}

// ─── Singleton ─────────────────────────────────────────────────────────────

export const modelCatalogSync = new ModelCatalogSync();
