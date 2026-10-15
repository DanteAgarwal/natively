// ---------------------------------------------------------------------------
// Model Registry — Public API (barrel export)
// ---------------------------------------------------------------------------

export type {
  InputModality,
  OutputModality,
  Capability,
  CostClass,
  ModelStatus,
  ModelHealth,
  TaskProfile,
  BillingMode,
  PrivacyMode,
  ProviderId,
  ModelRecord,
  RoutingRequest,
} from './types';

export { DEFAULT_MODEL_RECORDS } from './defaults';

export { ModelRegistry, modelRegistry } from './registry';

export {
  assertBillingAllowed,
  assertPrivacyAllowed,
  assertAllPolicies,
  filterByBilling,
  filterByPrivacy,
  filterByAllPolicies,
  PolicyViolationError,
} from './policyGuards';
export type { PolicyViolationType } from './policyGuards';

// Phase 1: Observability & Health
export {
  diagnostics,
  DiagnosticsTracker,
  ObservabilityRedactor,
} from './diagnostics';
export type {
  RequestTrace,
  RequestAttempt,
  DiagnosticMetrics,
  ErrorClass,
} from './diagnostics';

export {
  healthCheckManager,
  HealthCheckManager,
  TINY_TEST_IMAGE_BASE64,
  PROBE_PAYLOADS,
} from './healthChecks';
export type {
  ProbeResult,
  ModelHealthTelemetry,
} from './healthChecks';

export {
  modelCatalogSync,
  ModelCatalogSync,
} from './modelCatalogSync';
export type {
  CatalogDiff,
  CatalogSyncStatus,
} from './modelCatalogSync';

export {
  modelRegistryStore,
  ModelRegistryStore,
  DEFAULT_PREFERENCES,
} from './modelStore';
export type {
  ModelRegistryPreferences,
} from './modelStore';

// Phase 2: Provider Adapters & Discovery
export {
  providerRegistry,
  ProviderRegistry,
} from './providerAdapters/providerRegistry';
export {
  normalizeStandardError,
} from './providerAdapters/errorNormalizer';
export { GeminiAdapter } from './providerAdapters/geminiAdapter';
export { GroqAdapter } from './providerAdapters/groqAdapter';
export { OpenRouterAdapter } from './providerAdapters/openrouterAdapter';
export { OllamaAdapter } from './providerAdapters/ollamaAdapter';
export { CloudflareAdapter } from './providerAdapters/cloudflareAdapter';
export { HuggingFaceAdapter } from './providerAdapters/huggingfaceAdapter';
export type {
  ProviderAdapter,
  InvocationParams,
  InvocationResult,
  NormalizedError,
  ProviderFeatureFlag,
} from './providerAdapters/types';

// Phase 3: Resilience, Quality-Aware Routing & Orchestration
export {
  circuitBreakerManager,
  CircuitBreaker,
  CircuitBreakerManager,
} from './circuitBreaker';
export type {
  CircuitState,
  CircuitBreakerConfig,
  CircuitBreakerSnapshot,
} from './circuitBreaker';

export {
  quotaTracker,
  QuotaTracker,
} from './quotaTracker';
export type {
  QuotaLimits,
  QuotaSnapshot,
  QuotaHeadroom,
  HardCaps,
  HardCapViolation,
} from './quotaTracker';

export {
  capabilityResolver,
  CapabilityResolver,
  ModalityMismatchError,
} from './capabilityResolver';
export type {
  UnresolvedRequestParams,
} from './capabilityResolver';

export {
  routingPolicy,
  RoutingPolicy,
} from './routingPolicy';
export type {
  RoutingDecision,
  CandidateEvaluation,
  ScoreBreakdown,
} from './routingPolicy';

export {
  fallbackOrchestrator,
  FallbackOrchestrator,
  TASK_DEADLINES_MS,
} from './fallbackOrchestrator';
export type {
  OrchestratedExecutionResult,
} from './fallbackOrchestrator';

export {
  benchmarkHarness,
  BenchmarkHarness,
  BENCHMARK_SUITE,
} from './benchmarkHarness';
export type {
  BenchmarkPrompt,
  BenchmarkScore,
} from './benchmarkHarness';
