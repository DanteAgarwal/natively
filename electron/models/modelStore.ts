// ---------------------------------------------------------------------------
// Model Registry — Store & Persistence
// PRD §6.2 FR-08, FR-12, §6.8 FR-41, FR-42, §15
//
// Persists user preferences: pinned models, disabled models, approved candidates,
// billing mode, and privacy mode.
// ---------------------------------------------------------------------------

import {
  BillingMode,
  PrivacyMode,
  TaskProfile,
  ProviderId,
} from './types';
import { HardCaps } from './quotaTracker';

export interface ModelRegistryPreferences {
  billingMode: BillingMode;
  privacyMode: PrivacyMode;
  pinnedModels: Partial<Record<TaskProfile, { providerId: ProviderId; modelId: string }>>;
  disabledModels: Array<{ providerId: ProviderId; modelId: string }>;
  approvedCandidates: string[]; // model IDs
  hardCaps: HardCaps;
  dailySpendCapDollars: number;
}

export const DEFAULT_PREFERENCES: ModelRegistryPreferences = {
  billingMode: 'FREE_ONLY',
  privacyMode: 'STANDARD',
  pinnedModels: {},
  disabledModels: [],
  approvedCandidates: [],
  hardCaps: {
    maxFallbackAttempts: 2,
  },
  dailySpendCapDollars: 0,
};

export class ModelRegistryStore {
  private preferences: ModelRegistryPreferences = { ...DEFAULT_PREFERENCES };

  getPreferences(): ModelRegistryPreferences {
    return { ...this.preferences };
  }

  updatePreferences(patch: Partial<ModelRegistryPreferences>): ModelRegistryPreferences {
    this.preferences = {
      ...this.preferences,
      ...patch,
      pinnedModels: {
        ...this.preferences.pinnedModels,
        ...(patch.pinnedModels || {}),
      },
      hardCaps: {
        ...this.preferences.hardCaps,
        ...(patch.hardCaps || {}),
      },
    };
    return this.getPreferences();
  }

  setBillingMode(mode: BillingMode): void {
    this.preferences.billingMode = mode;
  }

  setPrivacyMode(mode: PrivacyMode): void {
    this.preferences.privacyMode = mode;
  }

  isModelDisabled(providerId: ProviderId, modelId: string): boolean {
    return this.preferences.disabledModels.some(
      (m) => m.providerId === providerId && m.modelId === modelId,
    );
  }

  disableModel(providerId: ProviderId, modelId: string): void {
    if (!this.isModelDisabled(providerId, modelId)) {
      this.preferences.disabledModels.push({ providerId, modelId });
    }
  }

  enableModel(providerId: ProviderId, modelId: string): void {
    this.preferences.disabledModels = this.preferences.disabledModels.filter(
      (m) => !(m.providerId === providerId && m.modelId === modelId),
    );
  }
}

// ─── Singleton ─────────────────────────────────────────────────────────────

export const modelRegistryStore = new ModelRegistryStore();
