const test = require('node:test');
const assert = require('node:assert');

// Test compiled outputs in dist-electron/models
const {
  modelRegistry,
  assertBillingAllowed,
  assertPrivacyAllowed,
  filterByBilling,
  filterByPrivacy,
  PolicyViolationError,
  circuitBreakerManager,
  CircuitBreaker,
  quotaTracker,
  QuotaTracker,
  diagnostics,
  ObservabilityRedactor,
  healthCheckManager,
  modelCatalogSync,
  providerRegistry,
  normalizeStandardError,
  capabilityResolver,
  ModalityMismatchError,
  routingPolicy,
  fallbackOrchestrator,
  benchmarkHarness,
  BENCHMARK_SUITE,
  modelRegistryStore,
} = require('../dist-electron/models');

// ─── Phase 0: Registry & Policy Guards ─────────────────────────────────────

test('Phase 0: Model Registry Defaults & Schema', () => {
  const allModels = modelRegistry.getAll();
  assert.ok(allModels.length >= 20, `Expected at least 20 models, got ${allModels.length}`);

  // Groq deprecated models
  const groq33 = modelRegistry.getById('groq', 'llama-3.3-70b-versatile');
  assert.ok(groq33, 'llama-3.3-70b-versatile must exist');
  assert.strictEqual(groq33.status, 'deprecated');

  const groq31 = modelRegistry.getById('groq', 'llama-3.1-8b-instant');
  assert.ok(groq31, 'llama-3.1-8b-instant must exist');
  assert.strictEqual(groq31.status, 'deprecated');

  // Cerebras PROMO_CREDIT check (PRD §7.2)
  const cerebras = modelRegistry.getById('router', 'cerebras/llama-3.3-70b');
  assert.ok(cerebras, 'Cerebras router preset must exist');
  assert.strictEqual(cerebras.costClass, 'PROMO_CREDIT');
});

test('Phase 0: Policy Guards - FREE_ONLY & LOCAL_ONLY', () => {
  const freeModel = modelRegistry.getById('gemini', 'gemini-3.8-flash');
  const promoModel = modelRegistry.getById('router', 'cerebras/llama-3.3-70b');
  const localModel = modelRegistry.getById('ollama', 'llama3.2');

  // FREE_ONLY allows FREE_QUOTA / FREE_MODEL
  assert.doesNotThrow(() => assertBillingAllowed(freeModel, 'FREE_ONLY'));

  // FREE_ONLY blocks PROMO_CREDIT
  assert.throws(
    () => assertBillingAllowed(promoModel, 'FREE_ONLY'),
    (err) => err instanceof PolicyViolationError && err.violationType === 'BILLING_BLOCKED',
  );

  // ALLOW_PAID allows promo
  assert.doesNotThrow(() => assertBillingAllowed(promoModel, 'ALLOW_PAID'));

  // LOCAL_ONLY blocks cloud
  assert.throws(
    () => assertPrivacyAllowed(freeModel, 'LOCAL_ONLY'),
    (err) => err instanceof PolicyViolationError && err.violationType === 'PRIVACY_BLOCKED',
  );

  // LOCAL_ONLY allows local model
  assert.doesNotThrow(() => assertPrivacyAllowed(localModel, 'LOCAL_ONLY'));
});

// ─── Phase 1: Observability, Diagnostics & Health ──────────────────────────

test('Phase 1: Observability Redactor - Secret Sanitization', () => {
  const rawMsg = 'Error communicating with Groq: gsk_1234567890abcdef1234567890abcdef invalid key';
  const redacted = ObservabilityRedactor.redactText(rawMsg);
  assert.ok(!redacted.includes('gsk_1234567890abcdef1234567890abcdef'));
  assert.ok(redacted.includes('[REDACTED_SECRET]'));

  const payload = {
    prompt: 'Secret confidential resume content',
    imageBase64: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==',
    modelId: 'gemini-3.8-flash',
  };
  const sanitized = ObservabilityRedactor.sanitizePayload(payload);
  assert.strictEqual(sanitized.prompt, '[REDACTED_PROMPT_CONTENT]');
  assert.strictEqual(sanitized.imageBase64, '[REDACTED_IMAGE_DATA]');
  assert.strictEqual(sanitized.modelId, 'gemini-3.8-flash');
});

test('Phase 1: Diagnostics Tracker - Traces and Metric Aggregations', () => {
  diagnostics.clearDiagnostics();

  diagnostics.recordTrace({
    requestId: 'test_1',
    timestamp: Date.now(),
    taskProfile: 'fast_text',
    requiredCapabilities: [],
    requiredInputModalities: ['text'],
    billingMode: 'FREE_ONLY',
    privacyMode: 'STANDARD',
    selectedProvider: 'groq',
    selectedModel: 'openai/gpt-oss-20b',
    totalDurationMs: 120,
    timeToFirstTokenMs: 45,
    fallbackCount: 0,
    attempts: [{
      providerId: 'groq',
      modelId: 'openai/gpt-oss-20b',
      attemptNumber: 1,
      startedAt: Date.now(),
      durationMs: 120,
      status: 'SUCCESS',
    }],
    status: 'SUCCESS',
  });

  const metrics = diagnostics.getMetrics();
  assert.strictEqual(metrics.totalRequests, 1);
  assert.strictEqual(metrics.successfulRequests, 1);
  assert.strictEqual(metrics.successRate, 1.0);
  assert.strictEqual(metrics.p50LatencyMs, 120);

  const exported = diagnostics.exportDiagnostics();
  assert.ok(exported.includes('"totalRequests": 1'));
});

test('Phase 1: Health Probes & Deprecation Review', () => {
  const telemetry = healthCheckManager.getTelemetry('gemini', 'gemini-3.8-flash');
  assert.ok(telemetry);

  healthCheckManager.recordProbeResult('gemini', 'gemini-3.8-flash', {
    ok: true,
    latencyMs: 85,
    testedCapability: 'basic_ping',
    timestamp: Date.now(),
  });

  const updated = healthCheckManager.getTelemetry('gemini', 'gemini-3.8-flash');
  assert.strictEqual(updated.health, 'healthy');
  assert.strictEqual(updated.consecutiveFailures, 0);

  // Deprecation review flags deprecated models
  const deprecatedList = healthCheckManager.runDeprecationReview();
  assert.ok(deprecatedList.length >= 2, 'Should flag deprecated Groq models');
});

test('Phase 1: Catalog Sync & Candidate Queue', () => {
  const rawDiscovery = {
    id: 'deepseek/deepseek-r1:free',
    name: 'DeepSeek R1 Free',
    context_length: 64000,
    pricing: { prompt: '0', completion: '0' },
  };

  const normalized = modelCatalogSync.normalizeOpenRouterModel(rawDiscovery);
  assert.strictEqual(normalized.providerId, 'openrouter');
  assert.strictEqual(normalized.costClass, 'FREE_MODEL');
  assert.strictEqual(normalized.status, 'candidate');

  const diff = modelCatalogSync.processDiscoveredModels('openrouter', [normalized]);
  assert.ok(diff.added.some((m) => m.modelId === 'deepseek/deepseek-r1:free'));

  const candidates = modelCatalogSync.getCandidates();
  assert.ok(candidates.some((c) => c.modelId === 'deepseek/deepseek-r1:free'));

  // Approve candidate
  const approved = modelCatalogSync.approveCandidate('deepseek/deepseek-r1:free');
  assert.strictEqual(approved, true);
});

// ─── Phase 2: Provider Adapters & Normalization ────────────────────────────

test('Phase 2: Provider Registry & Feature Flags', () => {
  const geminiAdapter = providerRegistry.getAdapter('gemini');
  assert.ok(geminiAdapter);
  assert.strictEqual(geminiAdapter.providerId, 'gemini');

  const ollamaAdapter = providerRegistry.getAdapter('ollama');
  assert.ok(ollamaAdapter);
  assert.strictEqual(ollamaAdapter.providerId, 'ollama');

  // Cloudflare is feature flagged
  const cfFlag = providerRegistry.getFeatureFlag('cloudflare');
  assert.strictEqual(cfFlag.enabled, false);

  // Hugging Face is feature flagged
  const hfFlag = providerRegistry.getFeatureFlag('huggingface');
  assert.strictEqual(hfFlag.enabled, false);
});

test('Phase 2: Error Normalization (429, 401, 404, 5xx, Network)', () => {
  // Rate limit with retry after
  const rateLimitErr = {
    status: 429,
    message: 'Rate limit reached. Please try again in 15s',
    headers: { 'retry-after': '15' },
  };
  const norm429 = normalizeStandardError(rateLimitErr);
  assert.strictEqual(norm429.errorClass, 'RATE_LIMIT_429');
  assert.strictEqual(norm429.statusCode, 429);
  assert.strictEqual(norm429.retryAfterMs, 15000);
  assert.strictEqual(norm429.isTransient, true);

  // Auth error
  const authErr = { status: 401, message: 'Invalid API key provided' };
  const norm401 = normalizeStandardError(authErr);
  assert.strictEqual(norm401.errorClass, 'AUTH_ERROR_401');
  assert.strictEqual(norm401.isTransient, false);

  // Model not found
  const notFoundErr = { status: 404, message: 'Model llama-3.3-70b does not exist' };
  const norm404 = normalizeStandardError(notFoundErr);
  assert.strictEqual(norm404.errorClass, 'NOT_FOUND_404');
  assert.strictEqual(norm404.isTransient, false);

  // Server error
  const serverErr = { status: 503, message: 'Service Unavailable' };
  const norm503 = normalizeStandardError(serverErr);
  assert.strictEqual(norm503.errorClass, 'SERVER_ERROR_5XX');
  assert.strictEqual(norm503.isTransient, true);
});

// ─── Phase 3: Resilience, Quotas & Routing ─────────────────────────────────

test('Phase 3: Circuit Breaker State Machine', () => {
  const cb = new CircuitBreaker('test-circuit', {
    failureThreshold: 3,
    cooldownMs: 50,
    maxCooldownMs: 200,
    backoffMultiplier: 2,
  });

  assert.strictEqual(cb.getState(), 'CLOSED');
  assert.strictEqual(cb.canAttempt(), true);

  // Fail 3 times -> OPEN
  cb.recordFailure();
  cb.recordFailure();
  assert.strictEqual(cb.getState(), 'CLOSED');
  cb.recordFailure();
  assert.strictEqual(cb.getState(), 'OPEN');
  assert.strictEqual(cb.canAttempt(), false);

  // Wait for cooldown -> HALF_OPEN
  return new Promise((resolve) => {
    setTimeout(() => {
      assert.strictEqual(cb.getState(), 'HALF_OPEN');
      assert.strictEqual(cb.canAttempt(), true);

      // Half-open success -> CLOSED
      cb.recordSuccess();
      assert.strictEqual(cb.getState(), 'CLOSED');
      resolve();
    }, 85);
  });
});

test('Phase 3: Sliding-Window Quota Tracker & Headroom', () => {
  const tracker = new QuotaTracker({ maxRequestsPerProviderPerDay: 100 });
  tracker.setLimits('provider:test', { rpm: 2, rpd: 50 });

  assert.strictEqual(tracker.hasHeadroom('provider:test'), true);
  assert.strictEqual(tracker.getHeadroom('provider:test').overall, 1.0);

  tracker.recordUsage('provider:test', 100);
  assert.strictEqual(tracker.getHeadroom('provider:test').requestMinuteRatio, 0.5);

  tracker.recordUsage('provider:test', 100);
  // Reached 2/2 RPM
  assert.strictEqual(tracker.getHeadroom('provider:test').requestMinuteRatio, 0.0);
  assert.strictEqual(tracker.hasHeadroom('provider:test'), false);
});

test('Phase 3: Capability Resolver & Modality Mismatch', () => {
  // Vision task without image throws ModalityMismatchError
  assert.throws(
    () => capabilityResolver.resolveRequest({ prompt: 'Describe', taskProfile: 'vision' }),
    (err) => err instanceof ModalityMismatchError,
  );

  // Vision task with image succeeds
  const resolved = capabilityResolver.resolveRequest({
    prompt: 'Describe',
    imageBase64: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==',
  });
  assert.ok(resolved.requiredCapabilities.includes('vision'));
  assert.ok(resolved.requiredInputModalities.includes('image'));
  assert.strictEqual(resolved.taskProfile, 'vision');
});

test('Phase 3: Task-Aware Routing Policy & Scoring', () => {
  const request = capabilityResolver.resolveRequest({
    prompt: 'Write a quick summary',
    taskProfile: 'fast_text',
    billingMode: 'FREE_ONLY',
    privacyMode: 'STANDARD',
  });

  const decision = routingPolicy.chooseRoute(request);
  assert.ok(decision.selectedModel);
  assert.ok(decision.score > 0);
  assert.ok(decision.explanation.includes('Selected'));
  assert.ok(decision.fallbackCandidates.length > 0);
});

test('Phase 3: Benchmark Harness Test Suite Definition', () => {
  assert.strictEqual(BENCHMARK_SUITE.length, 4);
  const fastTextBench = BENCHMARK_SUITE.find((b) => b.id === 'bench_fast_text');
  assert.ok(fastTextBench);
  assert.strictEqual(fastTextBench.validator('The capital of France is Paris.'), true);
  assert.strictEqual(fastTextBench.validator('London is big.'), false);
});
