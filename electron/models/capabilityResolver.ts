// ---------------------------------------------------------------------------
// Model Registry — Capability Resolver & Request Intent Parser
// PRD §6.3 FR-14, FR-15, FR-16, FR-17, §8.1 Steps 1-2
//
// Normalizes request intent, maps task profile into required capabilities,
// checks input modalities, and computes context token budget with safety margin.
// ---------------------------------------------------------------------------

import {
  Capability,
  InputModality,
  TaskProfile,
  BillingMode,
  PrivacyMode,
  ProviderId,
  RoutingRequest,
} from './types';

export interface UnresolvedRequestParams {
  prompt: string;
  taskProfile?: TaskProfile;
  imageBase64?: string;
  hasAudio?: boolean;
  requiresJson?: boolean;
  requiresTools?: boolean;
  billingMode?: BillingMode;
  privacyMode?: PrivacyMode;
  preferredProviderId?: ProviderId;
  preferredModelId?: string;
}

export class CapabilityResolver {
  /**
   * Resolves raw invocation arguments into a strictly validated RoutingRequest.
   * Throws an actionable error if an unsupported modality or invalid constraint is detected (FR-16).
   */
  resolveRequest(params: UnresolvedRequestParams): RoutingRequest {
    const requiredCapabilities: Capability[] = [];
    const requiredInputModalities: InputModality[] = ['text'];

    // 1. Modality detection (FR-16, FR-29, FR-34)
    if (params.imageBase64) {
      requiredInputModalities.push('image');
      if (!requiredCapabilities.includes('vision')) {
        requiredCapabilities.push('vision');
      }
    }

    if (params.hasAudio) {
      requiredInputModalities.push('audio');
      if (!requiredCapabilities.includes('transcription')) {
        requiredCapabilities.push('transcription');
      }
    }

    // 2. Structured output and tools (FR-17)
    if (params.requiresJson && !requiredCapabilities.includes('json_schema')) {
      requiredCapabilities.push('json_schema');
    }
    if (params.requiresTools && !requiredCapabilities.includes('tools')) {
      requiredCapabilities.push('tools');
    }

    // 3. Task Profile mapping (FR-18)
    const taskProfile = params.taskProfile || (params.imageBase64 ? 'vision' : 'general');

    switch (taskProfile) {
      case 'reasoning':
        if (!requiredCapabilities.includes('reasoning')) requiredCapabilities.push('reasoning');
        break;
      case 'coding':
        if (!requiredCapabilities.includes('coding')) requiredCapabilities.push('coding');
        break;
      case 'vision':
        if (!requiredCapabilities.includes('vision')) requiredCapabilities.push('vision');
        if (!requiredInputModalities.includes('image') && !params.imageBase64) {
          throw new ModalityMismatchError(
            'Vision task profile requested, but no image payload was supplied.',
            'image',
          );
        }
        break;
      case 'transcription':
        if (!requiredCapabilities.includes('transcription')) requiredCapabilities.push('transcription');
        break;
      case 'long_context':
        if (!requiredCapabilities.includes('long_context')) requiredCapabilities.push('long_context');
        break;
      case 'json':
        if (!requiredCapabilities.includes('json_schema')) requiredCapabilities.push('json_schema');
        break;
      case 'local_private':
        // local_private forces LOCAL_ONLY privacy mode
        params.privacyMode = 'LOCAL_ONLY';
        break;
      case 'fast_text':
      case 'general':
      default:
        break;
    }

    const billingMode = params.billingMode || 'FREE_ONLY';
    const privacyMode = params.privacyMode || 'STANDARD';

    return {
      requiredCapabilities,
      requiredInputModalities,
      billingMode,
      privacyMode,
      taskProfile,
      preferredProviderId: params.preferredProviderId,
      preferredModelId: params.preferredModelId,
    };
  }

  /**
   * Estimates prompt context budget in tokens with a safety margin (FR-15, FR-17).
   * ~4 chars per token for English text + base image token overhead.
   */
  estimateTokenBudget(prompt: string, hasImage: boolean = false): number {
    const textTokens = Math.ceil(prompt.length / 4);
    const imageTokens = hasImage ? 1600 : 0; // standard vision token budget
    const safetyMargin = 500;
    return textTokens + imageTokens + safetyMargin;
  }
}

export class ModalityMismatchError extends Error {
  constructor(message: string, public readonly missingModality: InputModality) {
    super(message);
    this.name = 'ModalityMismatchError';
  }
}

// ─── Singleton ─────────────────────────────────────────────────────────────

export const capabilityResolver = new CapabilityResolver();
