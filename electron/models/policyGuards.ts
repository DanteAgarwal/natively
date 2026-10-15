// ---------------------------------------------------------------------------
// Model Registry — Policy Guards
// Hard guardrails that enforce billing and privacy constraints BEFORE
// any request is dispatched to a provider (PRD §6.2 FR-08, FR-09, FR-10).
//
// These are designed to be called in the request lifecycle (PRD §8.1 step 3)
// to guarantee that FREE_ONLY mode never sends a paid request.
// ---------------------------------------------------------------------------

import {
  ModelRecord,
  BillingMode,
  CostClass,
  PrivacyMode,
} from './types';

// ─── Cost class eligibility sets ─────────────────────────────────────

/** Cost classes that pass the FREE_ONLY gate */
const FREE_ONLY_ELIGIBLE: Set<CostClass> = new Set([
  'FREE_MODEL',
  'FREE_QUOTA',
  'LOCAL_ZERO_METER',
]);

/** Cost classes that are NEVER eligible under FREE_ONLY — PRD §6.2 */
const FREE_ONLY_BLOCKED: Set<CostClass> = new Set([
  'PAID',
  'PROMO_CREDIT',
  'UNKNOWN',
]);

// ─── Billing guards ──────────────────────────────────────────────────

/**
 * Throws if a model is not eligible under the current billing mode.
 * Call this BEFORE dispatching any request (FR-09).
 *
 * This is a hard block, not a UI warning.
 */
export function assertBillingAllowed(model: ModelRecord, billingMode: BillingMode): void {
  if (billingMode === 'FREE_ONLY' && !FREE_ONLY_ELIGIBLE.has(model.costClass)) {
    throw new PolicyViolationError(
      `Blocked: model "${model.displayName}" (${model.modelId}) has cost class ` +
      `${model.costClass} which is not allowed in FREE_ONLY mode. ` +
      `Enable paid mode in settings to use this model.`,
      'BILLING_BLOCKED',
      model,
    );
  }
}

/**
 * Filters a list of models to only those eligible under the billing mode.
 * Returns a new array — does not mutate the input.
 */
export function filterByBilling(models: ModelRecord[], billingMode: BillingMode): ModelRecord[] {
  if (billingMode === 'ALLOW_PAID') {
    return models; // everything is eligible
  }
  return models.filter((m) => FREE_ONLY_ELIGIBLE.has(m.costClass));
}

// ─── Privacy guards ──────────────────────────────────────────────────

/**
 * Throws if a model would violate the privacy mode.
 * LOCAL_ONLY mode can only use LOCAL_ZERO_METER models (SEC-04).
 */
export function assertPrivacyAllowed(model: ModelRecord, privacyMode: PrivacyMode): void {
  if (privacyMode === 'LOCAL_ONLY' && model.costClass !== 'LOCAL_ZERO_METER') {
    throw new PolicyViolationError(
      `Blocked: model "${model.displayName}" (${model.modelId}) is a cloud model ` +
      `but LOCAL_ONLY privacy mode is enabled. Only local models are allowed.`,
      'PRIVACY_BLOCKED',
      model,
    );
  }
}

/**
 * Filters a list of models to only those compatible with the privacy mode.
 */
export function filterByPrivacy(models: ModelRecord[], privacyMode: PrivacyMode): ModelRecord[] {
  if (privacyMode === 'STANDARD') {
    return models;
  }
  if (privacyMode === 'LOCAL_ONLY') {
    return models.filter((m) => m.costClass === 'LOCAL_ZERO_METER');
  }
  // SENSITIVE: block models with concerning data-use notes or UNKNOWN cost
  return models.filter((m) => {
    if (m.costClass === 'UNKNOWN') return false;
    // In SENSITIVE mode, exclude explicitly experimental/unvetted models
    if (m.status === 'candidate') return false;
    return true;
  });
}

// ─── Combined guard ──────────────────────────────────────────────────

/**
 * Apply all policy guards at once. Call this before dispatch.
 * Throws on the first violation.
 */
export function assertAllPolicies(
  model: ModelRecord,
  billingMode: BillingMode,
  privacyMode: PrivacyMode,
): void {
  assertBillingAllowed(model, billingMode);
  assertPrivacyAllowed(model, privacyMode);
}

/**
 * Filter a model list through all policy guards at once.
 */
export function filterByAllPolicies(
  models: ModelRecord[],
  billingMode: BillingMode,
  privacyMode: PrivacyMode,
): ModelRecord[] {
  let result = filterByBilling(models, billingMode);
  result = filterByPrivacy(result, privacyMode);
  return result;
}

// ─── Error type ──────────────────────────────────────────────────────

export type PolicyViolationType = 'BILLING_BLOCKED' | 'PRIVACY_BLOCKED';

/**
 * Structured error for policy violations.
 * Callers can inspect `violationType` and `model` for diagnostics (PRD §6.9).
 */
export class PolicyViolationError extends Error {
  public readonly violationType: PolicyViolationType;
  public readonly model: ModelRecord;

  constructor(message: string, violationType: PolicyViolationType, model: ModelRecord) {
    super(message);
    this.name = 'PolicyViolationError';
    this.violationType = violationType;
    this.model = model;
  }
}
