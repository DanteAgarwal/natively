// ---------------------------------------------------------------------------
// Model Registry — Task-Aware Routing Policy & Scoring Engine
// PRD §6.4 FR-18, FR-19, FR-20, §6.8 FR-43, §8.1 Steps 3-4
//
// Formula:
//   score = 0.35 × task_quality + 0.25 × health + 0.20 × latency_fit +
//           0.10 × quota_headroom + 0.10 × privacy_fit
//
// Hard filters run first (capability, modality, billing, privacy, circuit breaker).
// Surviving candidates are ranked with this transparent, explainable formula.
// ---------------------------------------------------------------------------

import { ModelRecord, RoutingRequest, ProviderId, TaskProfile } from './types';
import { ModelRegistry, modelRegistry } from './registry';
import { circuitBreakerManager } from './circuitBreaker';
import { quotaTracker } from './quotaTracker';

export interface ScoreBreakdown {
  taskQuality: number;   // 0.0 - 1.0 (weight 0.35)
  health: number;        // 0.0 - 1.0 (weight 0.25)
  latencyFit: number;    // 0.0 - 1.0 (weight 0.20)
  quotaHeadroom: number; // 0.0 - 1.0 (weight 0.10)
  privacyFit: number;    // 0.0 - 1.0 (weight 0.10)
  preferenceBonus: number; // Pinned or preferred model bonus
  totalScore: number;
}

export interface CandidateEvaluation {
  model: ModelRecord;
  score: number;
  breakdown: ScoreBreakdown;
  isEligible: boolean;
  disqualificationReason?: string;
}

export interface RoutingDecision {
  selectedModel: ModelRecord;
  score: number;
  breakdown: ScoreBreakdown;
  explanation: string; // FR-43 "Why was this model selected?"
  fallbackCandidates: ModelRecord[];
}

export class RoutingPolicy {
  private pinnedModels = new Map<TaskProfile, { providerId: ProviderId; modelId: string }>();

  constructor(private registry: ModelRegistry = modelRegistry) {}

  /** Pin a preferred model for a specific task profile (FR-20) */
  pinModel(taskProfile: TaskProfile, providerId: ProviderId, modelId: string): void {
    this.pinnedModels.set(taskProfile, { providerId, modelId });
  }

  /** Unpin a model for a specific task profile */
  unpinModel(taskProfile: TaskProfile): void {
    this.pinnedModels.delete(taskProfile);
  }

  /** Get pinned model for a task profile */
  getPinnedModel(taskProfile: TaskProfile): { providerId: ProviderId; modelId: string } | undefined {
    return this.pinnedModels.get(taskProfile);
  }

  /**
   * Evaluates candidates and chooses the best model with fallbacks.
   * PRD §6.4 & §8.1.
   */
  chooseRoute(request: RoutingRequest): RoutingDecision {
    // 1. Get eligible models based on capabilities, modality, billing, and privacy
    const eligible = this.registry.getEligible(request);

    if (eligible.length === 0) {
      throw new Error(
        `No eligible models found for task profile "${request.taskProfile}" ` +
        `under billing mode "${request.billingMode}" and privacy mode "${request.privacyMode}".`,
      );
    }

    // 2. Score all eligible models that can attempt (circuit breakers and quotas)
    const evaluated: CandidateEvaluation[] = [];

    for (const model of eligible) {
      // Check circuit breaker
      const canAttemptCircuit = circuitBreakerManager.canAttemptModel(model.providerId, model.modelId);
      if (!canAttemptCircuit) {
        evaluated.push({
          model,
          score: 0,
          breakdown: this.zeroBreakdown(),
          isEligible: false,
          disqualificationReason: 'Circuit breaker is OPEN due to repeated failures.',
        });
        continue;
      }

      // Check quota headroom
      const providerHeadroom = quotaTracker.getHeadroom(`provider:${model.providerId}`).overall;
      const modelHeadroom = quotaTracker.getHeadroom(`model:${model.providerId}:${model.modelId}`).overall;
      const quotaHeadroom = Math.min(providerHeadroom, modelHeadroom);

      if (quotaHeadroom <= 0) {
        evaluated.push({
          model,
          score: 0,
          breakdown: this.zeroBreakdown(),
          isEligible: false,
          disqualificationReason: 'Provider or model rate limit quota is exhausted.',
        });
        continue;
      }

      // Score candidate
      const breakdown = this.calculateScore(model, request, quotaHeadroom);
      evaluated.push({
        model,
        score: breakdown.totalScore,
        breakdown,
        isEligible: true,
      });
    }

    // Filter surviving candidates and sort descending by total score
    const viable = evaluated
      .filter((e) => e.isEligible)
      .sort((a, b) => b.score - a.score);

    if (viable.length === 0) {
      const topDisqualification = evaluated[0]?.disqualificationReason || 'All candidate circuits or quotas are exhausted.';
      throw new Error(`All candidate models are temporarily unavailable: ${topDisqualification}`);
    }

    const winner = viable[0];
    const fallbacks = viable.slice(1).map((v) => v.model);

    // Format human-readable explanation (FR-43)
    const explanation =
      `Selected "${winner.model.displayName}" (${winner.model.providerId}) with score ${(winner.score * 100).toFixed(0)}/100. ` +
      `Breakdown: Quality=${(winner.breakdown.taskQuality * 100).toFixed(0)}%, ` +
      `Health=${(winner.breakdown.health * 100).toFixed(0)}%, ` +
      `Latency Fit=${(winner.breakdown.latencyFit * 100).toFixed(0)}%, ` +
      `Quota Headroom=${(winner.breakdown.quotaHeadroom * 100).toFixed(0)}%, ` +
      `Privacy Fit=${(winner.breakdown.privacyFit * 100).toFixed(0)}%.` +
      (winner.breakdown.preferenceBonus > 0 ? ' (User preference applied).' : '');

    return {
      selectedModel: winner.model,
      score: winner.score,
      breakdown: winner.breakdown,
      explanation,
      fallbackCandidates: fallbacks,
    };
  }

  private calculateScore(
    model: ModelRecord,
    request: RoutingRequest,
    quotaHeadroom: number,
  ): ScoreBreakdown {
    // 1. Task quality (0.35 weight)
    let taskQuality = 0.7; // baseline
    if (request.taskProfile === 'reasoning' && model.capabilities.includes('reasoning')) taskQuality = 1.0;
    else if (request.taskProfile === 'coding' && model.capabilities.includes('coding')) taskQuality = 1.0;
    else if (request.taskProfile === 'vision' && model.capabilities.includes('vision')) taskQuality = 1.0;
    else if (request.taskProfile === 'transcription' && model.capabilities.includes('transcription')) taskQuality = 1.0;
    else if (request.taskProfile === 'fast_text') taskQuality = 0.9;

    // 2. Health (0.25 weight)
    let health = 0.8;
    if (model.health === 'healthy') health = 1.0;
    else if (model.health === 'degraded') health = 0.5;
    else if (model.health === 'unknown') health = 0.7;
    else if (model.health === 'down') health = 0.0;

    // 3. Latency fit (0.20 weight)
    // Faster models score higher on fast_text; larger models on reasoning
    let latencyFit = 0.8;
    if (request.taskProfile === 'fast_text') {
      if (model.modelId.includes('flash') || model.modelId.includes('instant') || model.modelId.includes('mini')) {
        latencyFit = 1.0;
      }
    } else if (request.taskProfile === 'reasoning') {
      if (model.modelId.includes('70b') || model.modelId.includes('120b') || model.modelId.includes('pro')) {
        latencyFit = 0.95;
      }
    }

    // 4. Privacy fit (0.10 weight)
    let privacyFit = 0.8;
    if (model.costClass === 'LOCAL_ZERO_METER') privacyFit = 1.0;
    else if (model.providerId === 'gemini' || model.providerId === 'groq') privacyFit = 0.85;

    // 5. User preference / Pinning bonus
    let preferenceBonus = 0;
    const pinned = this.pinnedModels.get(request.taskProfile);
    if (pinned && pinned.providerId === model.providerId && pinned.modelId === model.modelId) {
      preferenceBonus = 0.25;
    } else if (request.preferredProviderId === model.providerId) {
      preferenceBonus += 0.10;
    }

    const totalScore = Math.min(
      1.0,
      0.35 * taskQuality +
        0.25 * health +
        0.20 * latencyFit +
        0.10 * quotaHeadroom +
        0.10 * privacyFit +
        preferenceBonus,
    );

    return {
      taskQuality,
      health,
      latencyFit,
      quotaHeadroom,
      privacyFit,
      preferenceBonus,
      totalScore,
    };
  }

  private zeroBreakdown(): ScoreBreakdown {
    return {
      taskQuality: 0,
      health: 0,
      latencyFit: 0,
      quotaHeadroom: 0,
      privacyFit: 0,
      preferenceBonus: 0,
      totalScore: 0,
    };
  }
}

// ─── Singleton ─────────────────────────────────────────────────────────────

export const routingPolicy = new RoutingPolicy();
