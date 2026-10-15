// ---------------------------------------------------------------------------
// Provider Registry — Adapter Factory & Manager
// PRD §6.1 FR-01, §10 SEC-02, §15
// ---------------------------------------------------------------------------

import { ProviderId } from '../types';
import { ProviderAdapter, ProviderFeatureFlag } from './types';
import { GeminiAdapter } from './geminiAdapter';
import { GroqAdapter } from './groqAdapter';
import { OpenRouterAdapter } from './openrouterAdapter';
import { OllamaAdapter } from './ollamaAdapter';
import { CloudflareAdapter } from './cloudflareAdapter';
import { HuggingFaceAdapter } from './huggingfaceAdapter';

export class ProviderRegistry {
  private adapters = new Map<ProviderId, ProviderAdapter>();
  private featureFlags = new Map<ProviderId, ProviderFeatureFlag>();

  constructor() {
    // Register core adapters
    this.adapters.set('gemini', new GeminiAdapter());
    this.adapters.set('groq', new GroqAdapter());
    this.adapters.set('openrouter', new OpenRouterAdapter());
    this.adapters.set('ollama', new OllamaAdapter());
    this.adapters.set('router', new OpenRouterAdapter()); // router preset uses OpenRouter/OpenAI-compatible

    // Register Phase 2 feature-flagged adapters
    const cf = new CloudflareAdapter(false);
    const hf = new HuggingFaceAdapter(false);
    this.adapters.set('cloudflare', cf);
    this.adapters.set('huggingface', hf);

    // Default feature flags & privacy classifications (PRD §10 SEC-02)
    this.featureFlags.set('gemini', {
      enabled: true,
      requiresKey: true,
      privacyRating: 'STANDARD_CLOUD',
    });
    this.featureFlags.set('groq', {
      enabled: true,
      requiresKey: true,
      privacyRating: 'STANDARD_CLOUD',
    });
    this.featureFlags.set('openrouter', {
      enabled: true,
      requiresKey: true,
      privacyRating: 'STANDARD_CLOUD',
    });
    this.featureFlags.set('ollama', {
      enabled: true,
      requiresKey: false,
      privacyRating: 'HIGH_LOCAL',
    });
    this.featureFlags.set('router', {
      enabled: true,
      requiresKey: false,
      privacyRating: 'COMMUNITY_UNVERIFIED',
    });
    this.featureFlags.set('cloudflare', {
      enabled: false,
      requiresKey: true,
      privacyRating: 'STANDARD_CLOUD',
    });
    this.featureFlags.set('huggingface', {
      enabled: false,
      requiresKey: true,
      privacyRating: 'STANDARD_CLOUD',
    });
  }

  getAdapter(providerId: ProviderId): ProviderAdapter {
    const adapter = this.adapters.get(providerId);
    if (!adapter) {
      throw new Error(`No adapter registered for provider "${providerId}".`);
    }
    return adapter;
  }

  getFeatureFlag(providerId: ProviderId): ProviderFeatureFlag | undefined {
    return this.featureFlags.get(providerId);
  }

  setFeatureFlag(providerId: ProviderId, flags: Partial<ProviderFeatureFlag>): void {
    const current = this.featureFlags.get(providerId) || {
      enabled: true,
      requiresKey: true,
      privacyRating: 'STANDARD_CLOUD',
    };
    const updated = { ...current, ...flags };
    this.featureFlags.set(providerId, updated);

    // Notify adapter if it supports feature flag toggle
    const adapter = this.adapters.get(providerId) as any;
    if (adapter && typeof adapter.setEnabled === 'function' && flags.enabled !== undefined) {
      adapter.setEnabled(flags.enabled);
    }
  }

  isProviderEnabled(providerId: ProviderId): boolean {
    const flag = this.featureFlags.get(providerId);
    return flag ? flag.enabled : true;
  }
}

// ─── Singleton ─────────────────────────────────────────────────────────────

export const providerRegistry = new ProviderRegistry();
