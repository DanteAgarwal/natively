// ---------------------------------------------------------------------------
// Provider Adapter Architecture — Core Types
// PRD §6.1 FR-01, FR-03, §6.5 FR-24, FR-25, §14 Phase 2
// ---------------------------------------------------------------------------

import { ProviderId, ModelRecord } from '../types';
import { ErrorClass } from '../diagnostics';

export interface NormalizedError {
  errorClass: ErrorClass;
  statusCode?: number;
  retryAfterMs?: number;
  isTransient: boolean;
  message: string;
  rawError?: any;
}

export interface InvocationParams {
  modelId: string;
  prompt: string;
  imageBase64?: string;
  audioBuffer?: Buffer;
  systemInstruction?: string;
  history?: Array<{ role: 'user' | 'model'; text: string }>;
  temperature?: number;
  maxTokens?: number;
  onChunk?: (chunk: string) => void;
  isAborted?: () => boolean;
}

export interface InvocationResult {
  text: string;
  timeToFirstTokenMs?: number;
  totalDurationMs: number;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
}

export interface ProviderAdapter {
  readonly providerId: ProviderId;

  /** Fetch live models from provider catalog (FR-01) */
  listModels(): Promise<ModelRecord[]>;

  /** Run a minimal probe against a model (FR-01, FR-41) */
  healthCheck(modelId: string): Promise<{ ok: boolean; latencyMs: number; error?: string }>;

  /** Execute a model invocation (FR-01) */
  invoke(params: InvocationParams): Promise<InvocationResult>;

  /** Stream model invocation chunks (FR-01) */
  streamInvoke?(params: InvocationParams): Promise<InvocationResult>;

  /** Map provider-specific error into a normalized classification (FR-01, FR-24, FR-25) */
  normalizeError(error: any): NormalizedError;
}

export interface ProviderFeatureFlag {
  enabled: boolean;
  requiresKey: boolean;
  privacyRating: 'HIGH_LOCAL' | 'STANDARD_CLOUD' | 'COMMUNITY_UNVERIFIED';
}
