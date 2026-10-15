// ---------------------------------------------------------------------------
// Model Registry — Fallback & Resilience Orchestrator
// PRD §6.5 FR-22, FR-23, FR-24, FR-25, FR-28, §8.1 Steps 5-7
//
// Coordinates model invocation across primary routes and independent fallbacks.
// Enforces max provider switches (default 2), deadline timeouts per task profile,
// respects Retry-After windows, updates circuit breakers and quotas, and produces
// complete diagnostic traces.
// ---------------------------------------------------------------------------

import { ModelRecord, RoutingRequest, ProviderId, TaskProfile } from './types';
import { RoutingPolicy, routingPolicy, RoutingDecision } from './routingPolicy';
import { ProviderRegistry, providerRegistry } from './providerAdapters/providerRegistry';
import { circuitBreakerManager } from './circuitBreaker';
import { quotaTracker } from './quotaTracker';
import { diagnostics, RequestTrace, RequestAttempt } from './diagnostics';
import { InvocationParams, InvocationResult } from './providerAdapters/types';

export const TASK_DEADLINES_MS: Record<TaskProfile, number> = {
  fast_text: 12_000,
  general: 30_000,
  reasoning: 90_000,
  coding: 45_000,
  vision: 30_000,
  transcription: 60_000,
  long_context: 90_000,
  json: 30_000,
  local_private: 60_000,
};

export interface OrchestratedExecutionResult {
  text: string;
  selectedModel: ModelRecord;
  trace: RequestTrace;
  fallbackCount: number;
}

export class FallbackOrchestrator {
  constructor(
    private policy: RoutingPolicy = routingPolicy,
    private providers: ProviderRegistry = providerRegistry,
  ) {}

  /**
   * Execute request with transparent, bounded fallback failover across providers.
   * Maps to PRD §6.5.
   */
  async execute(
    request: RoutingRequest,
    params: Omit<InvocationParams, 'modelId'>,
    options?: { maxProviderSwitches?: number; deadlineMs?: number },
  ): Promise<OrchestratedExecutionResult> {
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const startTime = Date.now();
    const maxSwitches = options?.maxProviderSwitches ?? 2; // FR-23
    const deadlineMs = options?.deadlineMs ?? TASK_DEADLINES_MS[request.taskProfile] ?? 30_000;
    const deadlineTimestamp = startTime + deadlineMs;

    // 1. Choose initial route
    const decision: RoutingDecision = this.policy.chooseRoute(request);
    let currentModel: ModelRecord = decision.selectedModel;

    // Queue fallback candidates, prioritizing independent providers (FR-22)
    const candidatesQueue: ModelRecord[] = [
      currentModel,
      ...this.prioritizeIndependentProviders(currentModel.providerId, decision.fallbackCandidates),
    ];

    const attempts: RequestAttempt[] = [];
    let providerSwitches = 0;
    let lastProviderId = currentModel.providerId;
    let finalError: any = null;
    let successfulResult: InvocationResult | null = null;
    let successfulModel: ModelRecord | null = null;

    for (let i = 0; i < candidatesQueue.length; i++) {
      currentModel = candidatesQueue[i];

      // Check deadline timeout
      if (Date.now() >= deadlineTimestamp) {
        finalError = new Error(`Request exceeded deadline of ${deadlineMs}ms for task ${request.taskProfile}.`);
        break;
      }

      // Check provider switch limit (FR-23)
      if (currentModel.providerId !== lastProviderId) {
        providerSwitches++;
        if (providerSwitches > maxSwitches) {
          finalError = new Error(`Maximum provider switches (${maxSwitches}) reached.`);
          break;
        }
        lastProviderId = currentModel.providerId;
      }

      // Verify circuit breaker right before dispatch
      if (!circuitBreakerManager.canAttemptModel(currentModel.providerId, currentModel.modelId)) {
        continue;
      }

      const attemptStart = Date.now();
      const attemptNumber = attempts.length + 1;

      try {
        const adapter = this.providers.getAdapter(currentModel.providerId);
        const invocationParams: InvocationParams = {
          ...params,
          modelId: currentModel.modelId,
        };

        let result: InvocationResult;
        if (params.onChunk && adapter.streamInvoke) {
          result = await adapter.streamInvoke(invocationParams);
        } else {
          result = await adapter.invoke(invocationParams);
        }

        const durationMs = Date.now() - attemptStart;

        // Record attempt success
        attempts.push({
          providerId: currentModel.providerId,
          modelId: currentModel.modelId,
          attemptNumber,
          startedAt: attemptStart,
          durationMs,
          status: 'SUCCESS',
        });

        // Update circuit breaker & quota tracker
        circuitBreakerManager.recordModelSuccess(currentModel.providerId, currentModel.modelId);
        quotaTracker.recordUsage(`provider:${currentModel.providerId}`, result.usage?.totalTokens || 0);
        quotaTracker.recordUsage(`model:${currentModel.providerId}:${currentModel.modelId}`, result.usage?.totalTokens || 0);

        successfulResult = result;
        successfulModel = currentModel;
        break; // Request succeeded!
      } catch (rawError: any) {
        const durationMs = Date.now() - attemptStart;
        const adapter = this.providers.getAdapter(currentModel.providerId);
        const normalized = adapter.normalizeError(rawError);

        attempts.push({
          providerId: currentModel.providerId,
          modelId: currentModel.modelId,
          attemptNumber,
          startedAt: attemptStart,
          durationMs,
          status: 'FAILED',
          errorClass: normalized.errorClass,
          errorMessage: normalized.message,
          statusCode: normalized.statusCode,
          retryAfterMs: normalized.retryAfterMs,
        });

        // Update circuit breaker
        circuitBreakerManager.recordModelFailure(currentModel.providerId, currentModel.modelId);
        finalError = rawError;

        // Handle specific error classes (FR-24, FR-25)
        if (normalized.errorClass === 'RATE_LIMIT_429') {
          // If 429 has retryAfter and deadline permits waiting on same model, we could wait;
          // otherwise switch immediately to next independent provider (FR-24)
          const canWait = normalized.retryAfterMs && Date.now() + normalized.retryAfterMs < deadlineTimestamp;
          if (canWait && normalized.retryAfterMs! <= 3000) {
            await new Promise((r) => setTimeout(r, normalized.retryAfterMs));
          }
          // Continue to next candidate
        } else if (
          normalized.errorClass === 'NOT_FOUND_404' ||
          normalized.errorClass === 'AUTH_ERROR_401' ||
          normalized.errorClass === 'INVALID_REQUEST_400'
        ) {
          // Do NOT retry same model or configuration (FR-25). Continue to next candidate.
        }

        // Inform user via stream chunk if another candidate exists
        const nextCandidate = candidatesQueue[i + 1];
        if (nextCandidate && params.onChunk) {
          params.onChunk(
            `\n\n> ⚠️ *${currentModel.displayName} failed (${normalized.errorClass}): ${normalized.message}. Auto-switching to ${nextCandidate.displayName}...*\n\n`,
          );
        }
      }
    }

    const totalDurationMs = Date.now() - startTime;
    const fallbackCount = Math.max(0, attempts.length - 1);
    const traceStatus = successfulResult ? 'SUCCESS' : 'FAILED';

    const trace: RequestTrace = {
      requestId,
      timestamp: startTime,
      taskProfile: request.taskProfile,
      requiredCapabilities: request.requiredCapabilities,
      requiredInputModalities: request.requiredInputModalities,
      billingMode: request.billingMode,
      privacyMode: request.privacyMode,
      selectedProvider: successfulModel?.providerId || decision.selectedModel.providerId,
      selectedModel: successfulModel?.modelId || decision.selectedModel.modelId,
      costClass: successfulModel?.costClass || decision.selectedModel.costClass,
      selectionReason: decision.explanation,
      timeToFirstTokenMs: successfulResult?.timeToFirstTokenMs,
      totalDurationMs,
      estimatedTokens: successfulResult?.usage,
      fallbackCount,
      attempts,
      status: traceStatus,
      finalErrorClass: successfulResult ? undefined : attempts[attempts.length - 1]?.errorClass,
      finalErrorMessage: successfulResult ? undefined : finalError?.message,
    };

    // Record trace in diagnostics
    diagnostics.recordTrace(trace);

    if (!successfulResult || !successfulModel) {
      throw new Error(
        `All candidates failed after ${attempts.length} attempts (${providerSwitches} provider switches). ` +
        `Last error: ${finalError?.message || 'Unknown failure'}`,
      );
    }

    return {
      text: successfulResult.text,
      selectedModel: successfulModel,
      trace,
      fallbackCount,
    };
  }

  /**
   * Sort fallback models to prefer independent providers first (FR-22).
   */
  private prioritizeIndependentProviders(
    primaryProviderId: ProviderId,
    fallbacks: ModelRecord[],
  ): ModelRecord[] {
    const independent = fallbacks.filter((m) => m.providerId !== primaryProviderId);
    const sameProvider = fallbacks.filter((m) => m.providerId === primaryProviderId);
    return [...independent, ...sameProvider];
  }
}

// ─── Singleton ─────────────────────────────────────────────────────────────

export const fallbackOrchestrator = new FallbackOrchestrator();
