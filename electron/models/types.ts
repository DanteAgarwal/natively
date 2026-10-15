// ---------------------------------------------------------------------------
// Model Registry — Core Types
// Maps to PRD §6.1–6.4, §8.2
// YAGNI: only fields used by the current codebase or Phase 0 requirements.
// ---------------------------------------------------------------------------

/** What the model accepts as input */
export type InputModality = 'text' | 'image' | 'audio' | 'video' | 'pdf';

/** What the model produces */
export type OutputModality = 'text' | 'audio' | 'image' | 'json';

/**
 * What the model is capable of — PRD §6.3 capability registry.
 * A request declares required capabilities; ineligible models are filtered
 * out before scoring (FR-15).
 */
export type Capability =
  | 'reasoning'
  | 'coding'
  | 'vision'
  | 'tools'
  | 'json_schema'
  | 'transcription'
  | 'long_context';

/**
 * Economic contract for a model — PRD §6.2.
 * The router treats these as hard eligibility constraints, not soft scores.
 */
export type CostClass =
  | 'FREE_MODEL'       // $0 inference pricing in a current listing
  | 'FREE_QUOTA'       // Ongoing free allowance with daily/monthly limits
  | 'PROMO_CREDIT'     // One-time trial/signup credit, may expire
  | 'LOCAL_ZERO_METER' // User-controlled local hardware, no token bill
  | 'PAID'             // Inference has a charge
  | 'UNKNOWN';         // Pricing undocumented, stale, or account-specific

/** Model lifecycle status — PRD §6.1 FR-06 */
export type ModelStatus =
  | 'verified'    // Metadata confirmed, probe passed — eligible for auto-routing
  | 'candidate'   // Discovered but not yet probed or approved
  | 'degraded'    // Partially working (elevated errors / latency)
  | 'deprecated'  // Scheduled or past shutdown — should not auto-route
  | 'disabled'    // Manually turned off by user or system
  | 'unknown';    // No information available

/** Live health state — PRD §8.2 */
export type ModelHealth = 'healthy' | 'degraded' | 'down' | 'unknown';

/** Task routing profile — PRD §6.4 FR-18 */
export type TaskProfile =
  | 'fast_text'
  | 'general'
  | 'reasoning'
  | 'coding'
  | 'vision'
  | 'transcription'
  | 'long_context'
  | 'json'
  | 'local_private';

/** Account billing mode — PRD §6.2 FR-08 */
export type BillingMode = 'FREE_ONLY' | 'ALLOW_PAID';

/** Privacy enforcement level — PRD §10 */
export type PrivacyMode = 'STANDARD' | 'SENSITIVE' | 'LOCAL_ONLY';

/** Provider identifier — matches existing and expanded provider boundaries */
export type ProviderId = 'gemini' | 'groq' | 'openrouter' | 'ollama' | 'router' | 'cloudflare' | 'huggingface';

// ---------------------------------------------------------------------------
// ModelRecord — The canonical model entry (PRD §8.2)
// ---------------------------------------------------------------------------

export interface ModelRecord {
  /** Which provider serves this model */
  providerId: ProviderId;

  /** Exact provider-facing model ID (e.g. "gemini-3.8-flash") */
  modelId: string;

  /** Human-readable name for UI */
  displayName: string;

  /** Lifecycle status — only 'verified' models auto-route by default */
  status: ModelStatus;

  /** What input types the model accepts */
  inputModalities: InputModality[];

  /** What the model produces */
  outputModalities: OutputModality[];

  /** Task capabilities — used for hard eligibility filtering */
  capabilities: Capability[];

  /** Economic contract */
  costClass: CostClass;

  /** Maximum context window in tokens */
  contextWindow: number;

  /** Current operational health */
  health: ModelHealth;

  /** URL to pricing/free-tier evidence for audit trail */
  pricingEvidenceUrl?: string;

  /** Provider data-use/training policy note */
  dataUseNote?: string;

  /** Why this model is deprecated and what replaces it */
  deprecationNote?: string;

  /** Known rate limits */
  quota?: {
    rpm?: number;   // requests per minute
    rpd?: number;   // requests per day
    tpm?: number;   // tokens per minute
    tpd?: number;   // tokens per day
  };
}

// ---------------------------------------------------------------------------
// RoutingRequest — What a caller asks for (Phase 0 shape, not wired yet)
// ---------------------------------------------------------------------------

export interface RoutingRequest {
  /** Hard-required capabilities — model must have ALL of these */
  requiredCapabilities: Capability[];

  /** Hard-required input modalities — model must accept ALL of these */
  requiredInputModalities: InputModality[];

  /** Current billing policy */
  billingMode: BillingMode;

  /** Privacy constraint */
  privacyMode: PrivacyMode;

  /** Task profile for preference ordering */
  taskProfile: TaskProfile;

  /** Caller's preferred provider (soft preference, not hard filter) */
  preferredProviderId?: ProviderId;

  /** Caller's preferred model (soft preference) */
  preferredModelId?: string;
}
