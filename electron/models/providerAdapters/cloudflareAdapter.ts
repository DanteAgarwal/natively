// ---------------------------------------------------------------------------
// Provider Adapter — Cloudflare Workers AI
// PRD §7, §14 Phase 2 (Feature-Flagged)
//
// Offers 10,000 Neurons/day free allocation.
// ---------------------------------------------------------------------------

import { ProviderAdapter, InvocationParams, InvocationResult, NormalizedError } from './types';
import { normalizeStandardError } from './errorNormalizer';
import { ModelRecord } from '../types';
import { modelRegistry } from '../registry';

export class CloudflareAdapter implements ProviderAdapter {
  readonly providerId = 'cloudflare' as const;
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
    return modelRegistry.getByProvider('cloudflare');
  }

  async healthCheck(modelId: string): Promise<{ ok: boolean; latencyMs: number; error?: string }> {
    if (!this.isEnabled) {
      return { ok: false, latencyMs: 0, error: 'Cloudflare Workers AI adapter is currently disabled by feature flag.' };
    }
    const start = Date.now();
    return { ok: true, latencyMs: Date.now() - start };
  }

  async invoke(params: InvocationParams): Promise<InvocationResult> {
    if (!this.isEnabled) {
      throw new Error('Cloudflare Workers AI is disabled by feature flag. Enable it in provider settings.');
    }
    const start = Date.now();
    // In Phase 2, invocation is stubbed behind the feature flag or calls Cloudflare API
    return {
      text: `[Cloudflare Workers AI - ${params.modelId}]: Feature flagged placeholder response.`,
      totalDurationMs: Date.now() - start,
    };
  }

  normalizeError(error: any): NormalizedError {
    return normalizeStandardError(error);
  }
}
