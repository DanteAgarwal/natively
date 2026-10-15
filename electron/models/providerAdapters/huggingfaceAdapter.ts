// ---------------------------------------------------------------------------
// Provider Adapter — Hugging Face Inference Providers
// PRD §7, §14 Phase 2 (Feature-Flagged)
//
// Hugging Face offers $0.10 monthly exploratory credit. Not an ongoing free tier.
// ---------------------------------------------------------------------------

import { ProviderAdapter, InvocationParams, InvocationResult, NormalizedError } from './types';
import { normalizeStandardError } from './errorNormalizer';
import { ModelRecord } from '../types';
import { modelRegistry } from '../registry';

export class HuggingFaceAdapter implements ProviderAdapter {
  readonly providerId = 'huggingface' as const;
  private isEnabled: boolean = false; // Feature flag for Phase 2

  constructor(enabled: boolean = false) {
    this.isEnabled = enabled;
  }

  setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
  }

  isFeatureEnabled(): boolean {
    return this.isEnabled;
  }

  async listModels(): Promise<ModelRecord[]> {
    return modelRegistry.getByProvider('huggingface');
  }

  async healthCheck(modelId: string): Promise<{ ok: boolean; latencyMs: number; error?: string }> {
    if (!this.isEnabled) {
      return { ok: false, latencyMs: 0, error: 'Hugging Face adapter is currently disabled by feature flag.' };
    }
    const start = Date.now();
    return { ok: true, latencyMs: Date.now() - start };
  }

  async invoke(params: InvocationParams): Promise<InvocationResult> {
    if (!this.isEnabled) {
      throw new Error('Hugging Face adapter is disabled by feature flag. Enable it in provider settings.');
    }
    const start = Date.now();
    return {
      text: `[Hugging Face - ${params.modelId}]: Feature flagged placeholder response.`,
      totalDurationMs: Date.now() - start,
    };
  }

  normalizeError(error: any): NormalizedError {
    return normalizeStandardError(error);
  }
}
