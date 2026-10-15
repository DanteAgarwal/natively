// ---------------------------------------------------------------------------
// Model Registry — Default Model Records
// Migrates all hardcoded model arrays from geminiService, groqService,
// openrouterService, and routerService into canonical ModelRecord entries.
//
// PRD §7.2 actions applied:
//   - Groq llama-3.3-70b-versatile:  DEPRECATED (shutdown 16 Aug 2026)
//   - Groq llama-3.1-8b-instant:     DEPRECATED (shutdown 16 Aug 2026)
//   - OpenRouter gemini-2.0-flash:   DEPRECATED (Google API shutdown)
//   - Cerebras:                       PROMO_CREDIT (one-time $5 credit)
//
// YAGNI: no discovery, no HTTP calls — pure static data.
// ---------------------------------------------------------------------------

import { ModelRecord } from './types';

// ═══════════════════════════════════════════════════════════════════════════
// GEMINI MODELS
// Source: geminiService.ts ACTIVE_GEMINI_MODELS + PRD §7 row "Google Gemini API"
// Evidence: https://ai.google.dev/gemini-api/docs/pricing
// ═══════════════════════════════════════════════════════════════════════════

const GEMINI_MODELS: ModelRecord[] = [
  {
    providerId: 'gemini',
    modelId: 'gemini-3.8-flash',
    displayName: 'Gemini 3.8 Flash',
    status: 'verified',
    inputModalities: ['text', 'image', 'audio', 'video', 'pdf'],
    outputModalities: ['text', 'json'],
    capabilities: ['reasoning', 'coding', 'vision', 'tools', 'json_schema', 'long_context'],
    costClass: 'FREE_QUOTA',
    contextWindow: 1048576,
    health: 'unknown',
    pricingEvidenceUrl: 'https://ai.google.dev/gemini-api/docs/pricing',
    dataUseNote: 'Free-tier data may be used to improve Google products.',
  },
  {
    providerId: 'gemini',
    modelId: 'gemini-3.5-flash-lite',
    displayName: 'Gemini 3.5 Flash-Lite',
    status: 'verified',
    inputModalities: ['text', 'image', 'audio'],
    outputModalities: ['text'],
    capabilities: ['vision', 'transcription'],
    costClass: 'FREE_QUOTA',
    contextWindow: 1048576,
    health: 'unknown',
    pricingEvidenceUrl: 'https://ai.google.dev/gemini-api/docs/pricing',
    dataUseNote: 'Free-tier data may be used to improve Google products.',
  },
  {
    providerId: 'gemini',
    modelId: 'gemini-3.7-flash',
    displayName: 'Gemini 3.7 Flash',
    status: 'verified',
    inputModalities: ['text', 'image'],
    outputModalities: ['text', 'json'],
    capabilities: ['reasoning', 'coding', 'vision', 'tools', 'json_schema'],
    costClass: 'FREE_QUOTA',
    contextWindow: 1048576,
    health: 'unknown',
    pricingEvidenceUrl: 'https://ai.google.dev/gemini-api/docs/pricing',
    dataUseNote: 'Free-tier data may be used to improve Google products.',
  },
  {
    providerId: 'gemini',
    modelId: 'gemini-3.6-flash',
    displayName: 'Gemini 3.6 Flash',
    status: 'verified',
    inputModalities: ['text', 'image'],
    outputModalities: ['text'],
    capabilities: ['vision'],
    costClass: 'FREE_QUOTA',
    contextWindow: 1048576,
    health: 'unknown',
    pricingEvidenceUrl: 'https://ai.google.dev/gemini-api/docs/pricing',
    dataUseNote: 'Free-tier data may be used to improve Google products.',
  },
  {
    providerId: 'gemini',
    modelId: 'gemini-3.5-flash',
    displayName: 'Gemini 3.5 Flash',
    status: 'verified',
    inputModalities: ['text', 'image'],
    outputModalities: ['text'],
    capabilities: ['vision'],
    costClass: 'FREE_QUOTA',
    contextWindow: 1048576,
    health: 'unknown',
    pricingEvidenceUrl: 'https://ai.google.dev/gemini-api/docs/pricing',
    dataUseNote: 'Free-tier data may be used to improve Google products.',
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// GROQ MODELS
// Source: groqService.ts ACTIVE_GROQ_MODELS + PRD §7 row "Groq" + §7.2
// Evidence: https://console.groq.com/docs/rate-limits
// ═══════════════════════════════════════════════════════════════════════════

const GROQ_MODELS: ModelRecord[] = [
  // ── DEPRECATED: shutdown 16 Aug 2026 per Groq deprecation docs ──
  {
    providerId: 'groq',
    modelId: 'llama-3.3-70b-versatile',
    displayName: 'Llama 3.3 70B Versatile',
    status: 'deprecated',
    inputModalities: ['text'],
    outputModalities: ['text'],
    capabilities: ['reasoning', 'coding'],
    costClass: 'FREE_QUOTA',
    contextWindow: 131072,
    health: 'down',
    pricingEvidenceUrl: 'https://console.groq.com/docs/rate-limits',
    deprecationNote: 'Groq shutdown 16 Aug 2026. Replace with openai/gpt-oss-120b.',
  },
  {
    providerId: 'groq',
    modelId: 'llama-3.1-8b-instant',
    displayName: 'Llama 3.1 8B Instant',
    status: 'deprecated',
    inputModalities: ['text'],
    outputModalities: ['text'],
    capabilities: [],
    costClass: 'FREE_QUOTA',
    contextWindow: 131072,
    health: 'down',
    pricingEvidenceUrl: 'https://console.groq.com/docs/rate-limits',
    deprecationNote: 'Groq shutdown 16 Aug 2026. Replace with openai/gpt-oss-20b.',
  },

  // ── ACTIVE Groq text models ──
  {
    providerId: 'groq',
    modelId: 'openai/gpt-oss-120b',
    displayName: 'OpenAI GPT OSS 120B',
    status: 'verified',
    inputModalities: ['text'],
    outputModalities: ['text'],
    capabilities: ['reasoning', 'coding'],
    costClass: 'FREE_QUOTA',
    contextWindow: 131072,
    health: 'unknown',
    pricingEvidenceUrl: 'https://console.groq.com/docs/rate-limits',
  },
  {
    providerId: 'groq',
    modelId: 'openai/gpt-oss-20b',
    displayName: 'OpenAI GPT OSS 20B',
    status: 'verified',
    inputModalities: ['text'],
    outputModalities: ['text'],
    capabilities: ['coding'],
    costClass: 'FREE_QUOTA',
    contextWindow: 131072,
    health: 'unknown',
    pricingEvidenceUrl: 'https://console.groq.com/docs/rate-limits',
  },

  // ── Groq Whisper transcription models ──
  {
    providerId: 'groq',
    modelId: 'whisper-large-v3-turbo',
    displayName: 'Whisper Large V3 Turbo',
    status: 'verified',
    inputModalities: ['audio'],
    outputModalities: ['text'],
    capabilities: ['transcription'],
    costClass: 'FREE_QUOTA',
    contextWindow: 0,    // not applicable for STT
    health: 'unknown',
    pricingEvidenceUrl: 'https://console.groq.com/docs/rate-limits',
  },
  {
    providerId: 'groq',
    modelId: 'whisper-large-v3',
    displayName: 'Whisper Large V3',
    status: 'verified',
    inputModalities: ['audio'],
    outputModalities: ['text'],
    capabilities: ['transcription'],
    costClass: 'FREE_QUOTA',
    contextWindow: 0,
    health: 'unknown',
    pricingEvidenceUrl: 'https://console.groq.com/docs/rate-limits',
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// OPENROUTER MODELS
// Source: openrouterService.ts ACTIVE_OPENROUTER_MODELS + PRD §7.1
// Evidence: https://openrouter.ai/collections/free-models
// ═══════════════════════════════════════════════════════════════════════════

const OPENROUTER_MODELS: ModelRecord[] = [
  {
    providerId: 'openrouter',
    modelId: 'openrouter/free',
    displayName: 'OpenRouter Free Auto-Router',
    status: 'verified',
    inputModalities: ['text', 'image'],
    outputModalities: ['text'],
    capabilities: ['reasoning', 'coding', 'vision'],
    costClass: 'FREE_MODEL',
    contextWindow: 200000,
    health: 'unknown',
    pricingEvidenceUrl: 'https://openrouter.ai/pricing/',
    dataUseNote: 'Dynamic model selection — actual model/provider varies per request.',
    quota: { rpm: 20, rpd: 50 },
  },
  {
    providerId: 'openrouter',
    modelId: 'google/gemma-4-31b-it:free',
    displayName: 'Google Gemma 4 31B (Free)',
    status: 'verified',
    inputModalities: ['text', 'image'],
    outputModalities: ['text'],
    capabilities: ['reasoning', 'vision'],
    costClass: 'FREE_MODEL',
    contextWindow: 262144,
    health: 'unknown',
    pricingEvidenceUrl: 'https://openrouter.ai/collections/free-models',
    dataUseNote: 'Free inputs/outputs may be used to train/improve models.',
    quota: { rpm: 20, rpd: 50 },
  },
  {
    providerId: 'openrouter',
    modelId: 'google/gemma-4-26b-a4b-it:free',
    displayName: 'Google Gemma 4 26B A4B (Free)',
    status: 'verified',
    inputModalities: ['text', 'image'],
    outputModalities: ['text'],
    capabilities: ['vision'],
    costClass: 'FREE_MODEL',
    contextWindow: 262144,
    health: 'unknown',
    pricingEvidenceUrl: 'https://openrouter.ai/collections/free-models',
    dataUseNote: 'Free inputs/outputs may be used to train/improve models.',
    quota: { rpm: 20, rpd: 50 },
  },
  {
    providerId: 'openrouter',
    modelId: 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free',
    displayName: 'NVIDIA Nemotron 3 Nano Omni (Free)',
    status: 'verified',
    inputModalities: ['text', 'image'],
    outputModalities: ['text'],
    capabilities: ['reasoning', 'vision'],
    costClass: 'FREE_MODEL',
    contextWindow: 256000,
    health: 'unknown',
    pricingEvidenceUrl: 'https://openrouter.ai/collections/free-models',
    quota: { rpm: 20, rpd: 50 },
  },
  {
    providerId: 'openrouter',
    modelId: 'nvidia/nemotron-3.5-lightning:free',
    displayName: 'NVIDIA Nemotron 3.5 Lightning (Free)',
    status: 'verified',
    inputModalities: ['text'],
    outputModalities: ['text'],
    capabilities: ['long_context'],
    costClass: 'FREE_MODEL',
    contextWindow: 1000000,
    health: 'unknown',
    pricingEvidenceUrl: 'https://openrouter.ai/collections/free-models',
    quota: { rpm: 20, rpd: 50 },
  },
  {
    providerId: 'openrouter',
    modelId: 'nvidia/nemotron-3-super-120b-a12b:free',
    displayName: 'NVIDIA Nemotron 3 Super (Free)',
    status: 'verified',
    inputModalities: ['text'],
    outputModalities: ['text'],
    capabilities: ['reasoning'],
    costClass: 'FREE_MODEL',
    contextWindow: 262144,
    health: 'unknown',
    pricingEvidenceUrl: 'https://openrouter.ai/collections/free-models',
    quota: { rpm: 20, rpd: 50 },
  },
  {
    providerId: 'openrouter',
    modelId: 'cohere/north-mini-code:free',
    displayName: 'Cohere North Mini Code (Free)',
    status: 'verified',
    inputModalities: ['text'],
    outputModalities: ['text'],
    capabilities: ['coding', 'tools'],
    costClass: 'FREE_MODEL',
    contextWindow: 256000,
    health: 'unknown',
    pricingEvidenceUrl: 'https://openrouter.ai/collections/free-models',
    quota: { rpm: 20, rpd: 50 },
  },

  // ── DEPRECATED: Google shut down Gemini 2.0 Flash on its own API ──
  {
    providerId: 'openrouter',
    modelId: 'google/gemini-2.0-flash-exp:free',
    displayName: 'Gemini 2.0 Flash Experimental (Legacy)',
    status: 'deprecated',
    inputModalities: ['text', 'image'],
    outputModalities: ['text'],
    capabilities: ['vision'],
    costClass: 'FREE_MODEL',
    contextWindow: 1048576,
    health: 'down',
    pricingEvidenceUrl: 'https://ai.google.dev/gemini-api/docs/models',
    deprecationNote: 'Google Gemini 2.0 Flash API shut down. OpenRouter availability must be independently tested.',
    dataUseNote: 'Legacy — do not use for new routing.',
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// LOCAL / OLLAMA MODELS
// Source: routerService.ts ROUTER_PRESETS (ollama entry) + PRD §7 "Ollama"
// ═══════════════════════════════════════════════════════════════════════════

const LOCAL_MODELS: ModelRecord[] = [
  {
    providerId: 'ollama',
    modelId: 'llama3.2',
    displayName: 'Ollama Llama 3.2 (Local)',
    status: 'candidate',  // candidate until local probe confirms it is running
    inputModalities: ['text'],
    outputModalities: ['text'],
    capabilities: ['coding'],
    costClass: 'LOCAL_ZERO_METER',
    contextWindow: 131072,
    health: 'unknown',
    dataUseNote: 'Runs locally — no data sent to external services.',
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// ROUTER PRESETS (non-Ollama)
// These represent third-party OpenAI-compatible gateways where we don't
// control the model catalog. Classified conservatively per PRD §6.2.
// ═══════════════════════════════════════════════════════════════════════════

const ROUTER_MODELS: ModelRecord[] = [
  {
    providerId: 'router',
    modelId: 'pollinations/openai',
    displayName: 'Pollinations AI (Free Gateway)',
    status: 'candidate',
    inputModalities: ['text'],
    outputModalities: ['text'],
    capabilities: [],
    costClass: 'UNKNOWN',
    contextWindow: 128000,
    health: 'unknown',
    dataUseNote: 'No-key public gateway — no SLA, no privacy guarantees. Experimental only.',
  },
  {
    providerId: 'router',
    modelId: 'cerebras/llama-3.3-70b',
    displayName: 'Cerebras Cloud (Promo Credit)',
    status: 'candidate',
    inputModalities: ['text'],
    outputModalities: ['text'],
    capabilities: ['reasoning'],
    costClass: 'PROMO_CREDIT',
    contextWindow: 131072,
    health: 'unknown',
    pricingEvidenceUrl: 'https://www.cerebras.ai/pricing',
    dataUseNote: 'One-time $5 promotional credit with expiration. Not a permanent free tier.',
  },
  {
    providerId: 'router',
    modelId: 'deepinfra/meta-llama/Llama-3.3-70B-Instruct',
    displayName: 'DeepInfra Llama 3.3 70B',
    status: 'candidate',
    inputModalities: ['text'],
    outputModalities: ['text'],
    capabilities: ['reasoning', 'coding'],
    costClass: 'UNKNOWN',
    contextWindow: 131072,
    health: 'unknown',
    dataUseNote: 'Usage-based pricing — free credits may vary by account.',
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// COMBINED DEFAULT REGISTRY
// ═══════════════════════════════════════════════════════════════════════════

export const DEFAULT_MODEL_RECORDS: ModelRecord[] = [
  ...GEMINI_MODELS,
  ...GROQ_MODELS,
  ...OPENROUTER_MODELS,
  ...LOCAL_MODELS,
  ...ROUTER_MODELS,
];
