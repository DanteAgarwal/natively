# PRD Source

MODEL ROUTER

Free-Tier Discovery, Capability-Based Routing & Resilience

PRODUCT REQUIREMENTS DOCUMENT

**Build a router that knows what is available, what is free, and what can actually do the job.**

| Field | Value |

| --- | --- |

| Document status | Draft for implementation |

| Version | 1.0 |

| Research snapshot | 16 October 2026 |

| Primary audience | Product owner, frontend/backend engineers, QA |

| Target application | Desktop/web AI copilot with text, screen vision and speech transcription |

| Cost objective | $0 default operation; paid inference only after explicit opt-in |



Decision summary: move from a manually curated model list to a capability-aware, cost-aware registry with live discovery, health probes, explicit privacy policies and provider-independent fallbacks.




# 1. Executive summary


The application currently supports Google Gemini, Groq, OpenRouter, and a Universal Router that can connect to hosted gateways or local inference. It also has speech transcription and automatic vision routing. The current implementation is provider-rich but operationally brittle: model IDs are hardcoded, provider availability is assumed, several fallbacks overlap, and “free” is not consistently distinguished from free quota, promotional credit, or paid usage.

This PRD defines a provider/model control plane that discovers supported models, records capabilities and cost class, tests endpoints, routes each request to an eligible model, and fails over only to another endpoint that can satisfy the same request. It also defines a free-first operating mode that makes paid calls impossible unless the user explicitly enables them.

Recommended direction: keep a small curated default route, dynamically discover candidates from provider catalogs, and use measured health/quality rather than model-name count to choose fallbacks. The system should treat model IDs, quotas, prices, context windows, modalities, and deprecation status as volatile metadata.


# 2. Problem statement


- Hardcoded IDs age badly. Provider model names, endpoints, quotas, and retirement dates change faster than application release cycles.

- Fallbacks are not necessarily independent. Multiple aliases from one provider can resolve to the same backend or fail for the same account-level reason.

- Capability mismatch creates avoidable failures: text-only providers cannot serve screenshots, and a chat completion endpoint is not automatically a transcription endpoint.

- “Free” is ambiguous. A no-cost model, a quota-capped tier, a one-time trial credit, open weights, and a paid API with a free credit are different economic contracts.

- Blind retry loops waste daily quotas, inflate latency, and can turn one configuration error into dozens of failed requests.

- User data can be sent to external providers with different retention and training terms, particularly through community/free inference endpoints.


# 3. Product goals and non-goals



## Goals


- G1. Maintain a live registry of models and providers, including exact model ID, model family, endpoint, modality, capabilities, cost class, quotas when documented, last checked time, health and deprecation status.

- G2. Default to free-only routing with a hard guardrail that prevents paid requests unless the user explicitly opts in.

- G3. Route tasks to models by required capability and measured suitability: text, reasoning, coding, vision, audio transcription, structured output, tool calling and long context.

- G4. Fail over across genuinely independent provider endpoints while respecting modality, privacy policy, rate limits and request constraints.

- G5. Discover new providers and models from documented APIs and trusted catalogs; keep unverified discoveries out of automatic production routing.

- G6. Make the routing decision explainable through a “why this model?” trace and request diagnostics.

- G7. Support local models through Ollama/OpenAI-compatible gateways for private/offline work and to avoid per-token fees.


## Non-goals


- NG1. Guarantee uninterrupted, unlimited, zero-cost hosted inference. Free providers control quotas and capacity.

- NG2. Automatically scrape arbitrary websites, bypass rate limits, rotate identities, or evade service restrictions.

- NG3. Assume a model is good at a task solely because it has a large parameter count, context window or benchmark claim.

- NG4. Send user content to multiple providers simultaneously by default. Fan-out is opt-in and disallowed for private mode.

- NG5. Build a new inference serving stack in the first release. Ollama/LM Studio/vLLM remain external adapters.


# 4. Target users and core jobs


| Persona | Job to be done | Success signal |

| --- | --- | --- |

| Primary app user | Ask questions, debug code, analyze screenshots, or get a concise response without choosing a model manually. | Useful response; low latency; no unexpected spend. |

| Power user / developer | See what is available, pin preferred models, test endpoints, inspect failures, and bring their own keys. | Can diagnose failures and change routing without editing source code. |

| Privacy-sensitive user | Keep selected requests local or block providers with unsuitable data policies. | No external network call occurs for local-only requests. |

| Maintainer | Keep current with model launches, outages, quota changes and deprecations. | Stale/retired models are disabled or flagged before they cause user-visible failures. |




# 5. Product principles


- Free means free at request time. No automatic spend, paid fallback, or “trial credit” consumption without explicit opt-in.

- Capability first, preference second. A vision request cannot route to a text-only model just because that model is fast.

- Discovery is not approval. A newly discovered model starts as “candidate” until metadata and a minimal live probe pass.

- One request, one clear reason. Every routing attempt has a reason, a timeout, a bounded retry policy and an audit record.

- No retry storms. Respect Retry-After and provider reset headers; do not retry invalid requests, auth errors or unknown model IDs.

- Local means local. Private/local-only mode cannot silently cross a cloud boundary.


# 6. Scope and functional requirements



## 6.1 Provider and model discovery


- FR-01 (P0): Provide a provider adapter interface with listModels(), getModelDetails(), healthCheck(), invoke(), normalizeError() and getUsageMetadata().

- FR-02 (P0): Poll provider catalogs on a configurable schedule (default every 24 hours) and on explicit “Refresh catalog” action. Add per-provider timeouts and bounded concurrency.

- FR-03 (P0): Support OpenRouter catalog discovery and provider-specific model endpoints (e.g., Groq /openai/v1/models). For providers without reliable discovery APIs, use versioned adapter metadata plus live probes.

- FR-04 (P0): Normalize each model into a common schema. Preserve raw provider metadata and source URL for troubleshooting.

- FR-05 (P1): Detect changes in model ID, input/output modality, context limit, token pricing, rate limits, deprecation state and free-tier listing. Store a dated diff.

- FR-06 (P0): Every discovered model must carry a status: verified, candidate, degraded, deprecated, disabled or unknown. Only verified models can auto-route by default.

- FR-07 (P1): Track `lastCatalogSyncAt`, `lastSuccessfulProbeAt`, `lastFailureAt`, `consecutiveFailures`, `providerStatus` and a short failure reason.


## 6.2 Free-tier and cost classification


The system must not infer price class from naming alone. A `:free` suffix is a strong catalog signal but not proof of current availability, acceptable privacy terms, or a sustainable quota.

| Cost class | Meaning | Default routing |

| --- | --- | --- |

| FREE_MODEL | Model has $0 inference pricing in a current provider/catalog listing. | Eligible subject to quota, privacy and capability checks. |

| FREE_QUOTA | Provider documents an ongoing free allowance, often with daily/monthly limits. | Eligible; quota budget is tracked and enforced. |

| PROMO_CREDIT | Trial, signup or one-time credit, possibly requiring a payment method and expiry. | Disabled in free-only mode; opt-in only. |

| LOCAL_ZERO_METER | Runs on user-controlled local hardware; no provider token bill. | Eligible in local mode; disclose device resource usage. |

| PAID | Inference has a charge or needs prepaid balance. | Never eligible unless paid mode and budget are enabled. |

| UNKNOWN | Pricing/quota is undocumented, stale or account-specific. | Not eligible for automatic routing. |



- FR-08 (P0): Add account-level `billingMode = FREE_ONLY | ALLOW_PAID` with FREE_ONLY as the default.

- FR-09 (P0): Paid endpoints must be excluded before request dispatch when FREE_ONLY is enabled. Do not rely only on UI warnings.

- FR-10 (P0): Distinguish persistent free quota from promotional credits. Promo credits do not count as free for the default route.

- FR-11 (P1): Track estimated token use, requests/day, RPM/TPM/TPD limits where published, and the last known quota state. Treat unknown quotas conservatively.

- FR-12 (P1): Add optional hard caps: requests/provider/day, tokens/request, max output tokens, concurrency, and maximum fallback attempts.

- FR-13 (P0): If catalog pricing and configured cost disagree, route conservatively (higher/unknown cost) and show a metadata warning.


## 6.3 Capability registry and request requirements


| Capability | Request examples | Hard validation |

| --- | --- | --- |

| text | Chat, summarization, quick answer | Text input + text output. |

| reasoning | Multi-step analysis, planning, complex SQL logic | Reasoning-capable model or explicit fallback accepted by task profile. |

| coding | Debugging, code review, refactoring, tests | Code-capable candidate; tool support is a separate flag. |

| vision | Screenshot, chart, UI image, scanned page | Image input confirmed by metadata and image probe. |

| audio-transcription | Push-to-listen, meeting audio | Audio/transcription endpoint; valid audio payload and response parser. |

| structured-output | JSON payloads consumed by code | JSON mode/schema support verified; validate output after response. |

| tools | Tool/function calls | Tool-call schema support verified; never infer from OpenAI-compatible URL. |

| long-context | Large transcripts/documents | Context limit meets actual prompt plus expected output, with safety margin. |



- FR-14 (P0): Requests declare a required capability set, privacy mode, maximum latency, maximum spend, context budget, and fallback permission.

- FR-15 (P0): Filter ineligible models before scoring. A model missing any required hard capability cannot win by being fast or highly ranked.

- FR-16 (P1): Detect unsupported modalities and fail with an actionable message instead of silently stripping content.

- FR-17 (P1): Keep “supports tool calling”, “supports JSON schema”, “supports vision”, “supports audio input” and “supports audio transcription” as distinct flags.


## 6.4 Task-aware routing


After hard filters, rank candidates with a simple, explainable score. Do not use an opaque LLM to choose the next model on every call.

`score = 0.35 × task_quality + 0.25 × health + 0.20 × latency_fit + 0.10 × quota_headroom + 0.10 × privacy_fit`

Initial weights are a starting point and should be configurable. In FREE_ONLY mode, cost is a hard eligibility constraint rather than merely another score dimension.

- FR-18 (P0): Ship task profiles: `fast_text`, `general`, `reasoning`, `coding`, `vision`, `transcription`, `long_context`, `json`, and `local_private`.

- FR-19 (P1): Collect latency and successful-task feedback by model/profile. Do not compare raw benchmark scores from unrelated tasks.

- FR-20 (P1): Offer per-task pinned model and provider preference overrides.

- FR-21 (P1): Add an optional benchmark harness with fixed test prompts and human-rated usefulness. Never include private user conversations in benchmarks without opt-in.


## 6.5 Fallback, retries and circuit breaking


- FR-22 (P0): Fallback to a different provider endpoint where possible, not simply the next model alias from the same provider.

- FR-23 (P0): Maximum 2 provider switches per user request by default; cap total wall-clock time by the task profile.

- FR-24 (P0): Retry 429 only after the provider reset/Retry-After window when the task deadline allows; otherwise immediately switch to an independent eligible provider.

- FR-25 (P0): Do not retry 400/401/403/404/model-not-found errors unchanged. Mark the config/model/provider unhealthy and route onward if another valid candidate exists.

- FR-26 (P0): Open a circuit after 3 consecutive transient failures; half-open after cooldown (initially 60 seconds) with one probe request. Use exponential backoff with jitter for catalog/health jobs.

- FR-27 (P1): Support provider-level and model-level circuit states; account quota exhaustion may disable an entire provider for the quota reset window.

- FR-28 (P0): Fallbacks must preserve privacy mode, capabilities, output schema, billing mode and data residency constraints.


## 6.6 Vision and screen capture


- FR-29 (P0): Screen capture requests must be routed to a verified vision endpoint; no text-only endpoint may be used.

- FR-30 (P0): Add image-size limits, supported formats, optional resize/compression, timeout, and maximum image count per request.

- FR-31 (P1): Allow redaction of secrets, tokens, emails, faces or selected screen regions before upload. Redaction is explicit and visible.

- FR-32 (P0): Show the destination provider before or at first use and provide a local-only switch.

- FR-33 (P1): If every cloud vision model is unavailable, use a local vision model only when installed and capable; otherwise return a clear no-vision-capable-backend error.


## 6.7 Audio transcription


- FR-34 (P0): Keep transcription as a separate task and adapter from text generation. Normalize transcript text, language, segments/timestamps (if available), duration and provider metadata.

- FR-35 (P0): Support Whisper Large V3 Turbo as first candidate and Whisper Large V3 as optional fallback only while current provider catalog and limits support them.

- FR-36 (P0): Use Gemini audio understanding only when an adapter explicitly supports the payload and returns a validated transcript; do not assume the chat text API is a drop-in STT replacement.

- FR-37 (P1): Offer optional local STT (e.g., whisper.cpp/faster-whisper) for private mode where hardware permits.

- FR-38 (P0): Do not persist raw audio by default. Transcript persistence must be a separate user-controlled setting.


## 6.8 UI and user controls


- FR-39 (P0): Add a Model & Providers page showing provider connection status, model count, last sync, last probe, cost class and current failure reason.

- FR-40 (P0): Each model detail panel shows provider, exact ID, capability badges, context limit, cost class, quota/source, last verified time, privacy-data note and deprecation warning.

- FR-41 (P0): Add buttons: Refresh catalog, Test connection, Test model, Disable model, Pin as default, and View diagnostic details.

- FR-42 (P0): Add global Free-only toggle (default ON), paid-mode confirmation, hard daily spend cap and “Never use cloud” privacy mode.

- FR-43 (P1): Add “Why was this model selected?” detail listing filters, score components, fallback attempts and final outcome.

- FR-44 (P1): Add a candidate review queue for newly discovered models. The user may approve, disable or probe candidates.

- FR-45 (P1): Add import/export of provider configuration without exporting API keys by default.


## 6.9 Observability and diagnostics


- FR-46 (P0): Log request ID, task profile, selected provider/model, time to first token, total latency, status/error class, fallback count, tokens/estimated cost (if available), and privacy mode.

- FR-47 (P0): Redact prompts, screen contents, audio, headers, API keys and secrets from application logs by default.

- FR-48 (P1): Show a 7-day dashboard of success rate, latency p50/p95, errors by class, quota exhaustion, estimated cost and most used models.

- FR-49 (P1): Export diagnostics without prompt content; prompt logging requires a separate explicit opt-in.

- FR-50 (P0): Include a model deprecation review job that flags IDs missing from provider catalog or known shutdown lists.


# 7. Provider and model discovery research snapshot


Research snapshot date: 16 October 2026. Provider limits, pricing, model IDs and terms can change. All rates below are implementation clues, not immutable guarantees. The application must pull live metadata and re-probe before placing a model in production routing.

| Provider / source | Free economics (current evidence) | Recommended product role | Decision |

| --- | --- | --- | --- |

| OpenRouter free catalog [1][2] | Live free model list; pricing page documents 20 requests/minute and 50/day for free models; daily limit can rise to 1,000 after $10+ lifetime credits purchased. | Main model discovery hub; `openrouter/free` as a convenience fallback; explicit model pins for reproducibility. | P0 integrate; not unlimited. |

| Google Gemini API [4][5] | Free tier varies by model and API capability. Gemma 4 shows free input/output pricing in the public price table; Gemini 4 Argon is paid-only. Free-tier data may be used to improve Google products. | Primary hosted text/vision candidate if its model and account quota are verified. | P0; exact ID/quota check. |

| Groq [6][7][8] | Published free-plan limits exist for models including GPT-OSS 120B/20B and Whisper V3/Turbo. Limits are per account/org and can change. | Fast hosted inference and transcription; prefer active catalog IDs such as GPT-OSS or current Qwen. | P0; catalog-driven. |

| Cloudflare Workers AI [9][13] | 10,000 Neurons/day free allocation; excess needs Workers Paid. Some models require paid billing. | Independent provider, text/vision/ASR as models support. | P1; strong quota-defined candidate. |

| Hugging Face Inference Providers [10] | $0.10 monthly credit for Free users, subject to change; after that usage is paid. | Catalog exploration and smoke tests, not a sustained core fallback. | P2; do not label “ongoing free tier” beyond allowance. |

| Cerebras [11] | Current developer offer: one-time $5 promotional credit; valid payment method required, expires after 30 days. Not a permanent free quota. | Low-latency evaluation and optional paid mode. | P2; classify PROMO_CREDIT. |

| Ollama / local runtime | No provider token bill; user pays in local compute, electricity and storage. Model size affects speed and memory. | Offline/private fallback; test local device compatibility. | P0 adapter. |

| Pollinations / anonymous public gateways | Terms, availability, output quality, limits and data use may change; keyless endpoint is not a guarantee. | Experimental only; disable for private content by default. | P2; explicit opt-in. |

| NVIDIA NIM/API catalog | Potential source of hosted/open model experimentation; free availability and credits must be re-checked per account and model. | Research queue for additional provider adapters. | P2; unverified in this snapshot. |

| SambaNova Cloud | Potential high-throughput provider; no quota included here until current official pricing/limits are confirmed. | Research queue. | P2; verify before shipping. |

| Mistral API | Check current account tier, current model availability, and model-specific limits. Do not assume free API access from a free chat product. | Potential fallback if account plan supports API usage. | P2; verify. |

| DeepInfra / Together AI / Fireworks | Usage-based hosted inference; promotional credit or free access can vary by account and time. | Optional paid adapters; do not assume free. | P2; treat UNKNOWN until confirmed. |

| GitHub Models | Developer experimentation ecosystem, but quotas and model availability depend on current account/product terms. | Potential non-core developer/test adapter after official endpoint/quota validation. | P2; verify. |

| Alibaba Cloud Model Studio / Qwen APIs | Possible region-specific free quotas; product/region/model terms require current verification. | Optional provider-specific Qwen route. | P2; verify region/account. |




## 7.1 Current OpenRouter free-model candidates


These entries were visible in OpenRouter’s live free-model collection at research time. Their popularity ranking indicates usage, not guaranteed quality. The provider may change availability, context limits or policy.

| Candidate model ID / family | Best candidate role | Notes / risk |

| --- | --- | --- |

| `nvidia/nemotron-3-ultra:free` | Long-form reasoning, planning, agent orchestration | Catalog reports up to 1M context. Text-only in listing; do not route images to it. |

| `nvidia/nemotron-3.5-lightning:free` | High-throughput text, long-context workflows | Catalog reports up to 1M context. Validate output quality and latency under quota. |

| `poolside/laguna-s-2.1:free` | Coding and software engineering | Catalog reports 262K context. Listing warns free inputs/outputs may be used to train/improve models. |

| `dots-studio/dots3-note-preview:free` | Reasoning, coding, multimodal and longer workflows | Catalog reports 512K context and multimodal positioning; test actual image/audio payload support. |

| `nvidia/nemotron-3-super:free` | Heavy reasoning / multi-agent planning | Catalog reports 262K context in the current page; don't trust context assumptions without API metadata. |

| `thinking-machines/inkling:free` | Multimodal reasoning and tool use | Listing reports image and audio understanding; validate exact API behavior. |

| `cohere/north-mini-code:free` | Coding agent / refactoring / terminal tasks | Catalog reports 256K context and tool-use orientation. |

| `thinking-machines/inkling-small:free` | Smaller multimodal candidate | Benchmark against existing lightweight models before using as default. |

| `openrouter/free` | Dynamic fallback when specific model choice is less important | Good last-resort route, but results are less reproducible and actual model/provider is selected dynamically. |



Launch rule: every candidate above must be checked through the live model catalog, provider metadata, modality probe and free-only policy. Pin the selected model ID and record the upstream provider in the request trace.


## 7.2 Existing inventory audit


| Existing item | PRD action | Reason |

| --- | --- | --- |

| Groq `llama-3.3-70b-versatile` | Disable/remove from free/developer chain. | Groq lists shutdown on 16 Aug 2026 for free/developer tier; recommended replacements include GPT-OSS 120B or current Qwen. [7] |

| Groq `llama-3.1-8b-instant` | Disable/remove from free/developer chain. | Groq lists shutdown on 16 Aug 2026 for free/developer tier; recommended replacement is GPT-OSS 20B. [7] |

| Groq `openai/gpt-oss-120b`, `openai/gpt-oss-20b` | Keep, verify with current catalog and quota. | Current Groq model/rate-limit docs include these IDs. They should not be described as unlimited. |

| Groq `whisper-large-v3-turbo`, `whisper-large-v3` | Keep while live endpoint and quotas are verified. | Current model/rate limit pages include these transcription model IDs. [8] |

| Gemini `gemini-3.8-flash` | Keep as primary candidate, but use live model catalog. | Official model catalog lists it as stable; do not hardcode assumed quota or capabilities. [4] |

| Gemini `gemini-3.5-flash-lite` | Keep as lightweight candidate after endpoint validation. | Current official model/interaction docs list Flash-Lite variants; confirm exact endpoint and whether the route is text, TTS or live audio. |

| Gemini `gemini-3.7-flash`, `gemini-3.6-flash`, `gemini-3.5-flash` | Keep only those present in current API catalog and proven non-redundant by probe. | Avoid assuming IDs are aliases or independent backends without evidence. |

| OpenRouter `google/gemini-2.0-flash-exp:free` | Remove as default; probe only for migration/testing if it still appears. | Google marks Gemini 2.0 Flash shut down for its own API. OpenRouter availability is a separate question and must be tested independently. [4] |

| OpenRouter Gemma 4 models | Keep as candidates; verify current IDs/modalities. | Google model docs list Gemma 4 31B and 26B MoE; OpenRouter endpoint behavior is independently verified. |

| Universal Router: Pollinations | Experimental/disabled by default for sensitive data. | No-key does not establish stable SLA, free quota or privacy terms. |

| Cerebras preset | Keep adapter but classify account offer correctly. | Current public pricing describes a one-time $5 promotional credit with expiration/payment-method conditions, not guaranteed free access. [11] |




# 8. Proposed system architecture


The design keeps existing provider services where practical but adds a shared control plane. Request execution stays provider-specific; selection and policy become centralized.

- UI layer: task selection, provider setup, privacy mode, free-only guardrail, diagnostics and candidate approval.

- Router API: normalizes request intent, applies hard policy filters, chooses a route, executes bounded fallbacks, returns the response and trace.

- Model registry: canonical model IDs, provider IDs, capability flags, cost class, quota metadata, evidence source, sync/health state and deprecation markers.

- Provider adapters: Gemini, Groq/OpenAI-compatible, OpenRouter, Cloudflare, Hugging Face, Cerebras, Ollama, custom OpenAI-compatible gateway and experimental Pollinations.

- Catalog workers: fetch catalogs, compare metadata, verify model IDs, update candidate state and produce alerts.

- Health/benchmark workers: run tiny test requests on approved models, record latency and capability validity, and periodically score test prompts.

- Policy engine: free-only/pay mode, local-only mode, data-use restrictions, per-task requirements, timeout, quota budget and max cost.

- Observability store: metadata and request telemetry only by default. Prompts, screen captures and raw audio are not retained.


## 8.1 Request lifecycle


1. Parse intent: task profile + input modalities + privacy/data constraints + deadline + budget.

1. Resolve constraints: reject unsupported content and calculate input/context budget.

1. Candidate filter: active + verified + capability match + privacy match + free/paid policy match + quota headroom.

1. Rank candidates: task quality, live health, latency, quota headroom and user preference.

1. Execute one provider; stream output if supported.

1. Normalize/validate result: tool calls, JSON schema, transcript object or text response.

1. On failure: classify error; decide retry, cooldown or switch; preserve the same request policy.

1. Return response + sanitized trace; update metrics and model/provider state.


## 8.2 Suggested normalized model record


```ts
type ModelRecord = {
  providerId: string;
  modelId: string;                 // exact provider-facing ID
  displayName?: string;
  status: "verified" | "candidate" | "degraded" | "deprecated" | "disabled" | "unknown";
  inputModalities: Array<"text" | "image" | "audio" | "video" | "pdf">;
  outputModalities: Array<"text" | "audio" | "image" | "json">;
  capabilities: Array<"reasoning" | "coding" | "tools" | "json_schema" | "transcription">;
  costClass: "FREE_MODEL" | "FREE_QUOTA" | "PROMO_CREDIT" | "LOCAL_ZERO_METER" | "PAID" | "UNKNOWN";
  pricingEvidenceUrl?: string;
  quota?: { rpm?: number; rpd?: number; tpm?: number; tpd?: number; resetHint?: string };
  contextWindow?: number;
  maxOutputTokens?: number;
  lastCatalogSyncAt?: string;
  lastSuccessfulProbeAt?: string;
  lastFailureAt?: string;
  health: "healthy" | "degraded" | "down" | "unknown";
  dataUseNote?: string;
};
```


# 9. Routing policy and initial route table


| Task profile | First-choice pool | Independent fallback pool | Hard constraint |

| --- | --- | --- | --- |

| fast_text | Gemini Flash-Lite; Groq GPT-OSS 20B; lightweight OpenRouter free models | Ollama small quantized model; approved Cloudflare text model | Short latency; cap output length. |

| general | Gemini Flash; GPT-OSS 20B; OpenRouter free router | Cloudflare text; Ollama local model | Free-only and current quota. |

| reasoning | Gemini Flash; GPT-OSS 120B; Nemotron 3 Ultra/Super | OpenRouter free model router; local large model if viable | No text-only→vision mismatch; deadline-aware. |

| coding | Gemini Flash; Groq GPT-OSS 120B; North Mini Code / Laguna S 2.1 | Ollama code model; alternate hosted code candidate | Tool calling and code execution are separate capabilities. |

| vision | Gemini Flash; verified Gemma 4 vision; verified Inkling/Dots vision candidate | Cloudflare vision model if verified; local vision model | Image input must be supported and probed. |

| transcription | Groq Whisper Large V3 Turbo | Groq Whisper Large V3; local Whisper runtime | Audio upload rules and retention policy. |

| long_context | Nemotron 3 Ultra / 3.5 Lightning; verified long-context model | Gemini stable model that actually supports the required input | Compute actual tokens; never rely solely on catalog maximum. |

| json | Model with proven JSON-schema mode; Groq GPT-OSS or Gemini if API supports profile | Second verified structured-output endpoint | Validate schema; one repair attempt maximum. |

| local_private | Ollama/LM Studio local model | Local second model or clear failure | Network egress must be blocked for this request. |



This route table is a candidate policy, not fixed truth. An endpoint only enters an automatic pool after it passes a smoke test for the required capability, current free eligibility and acceptable data-use terms.


# 10. Security, privacy and abuse prevention


- SEC-01: Store API keys in OS credential storage or encrypted local secrets; never place keys in frontend bundles, source control, diagnostics or exported configs.

- SEC-02: Mark each provider with a data-use category: acceptable for private content, user-review required, or blocked for sensitive content. Default unknown to user-review/blocked.

- SEC-03: For free endpoints that may train on prompts, show a warning and block sensitive-data profiles by default unless the user explicitly accepts terms.

- SEC-04: Local-only mode must enforce network-egress policy in router code, not only change a UI label.

- SEC-05: Never rotate API keys/accounts to evade provider rate limits. Use documented quotas, backoff, caches, and user-owned independent providers.

- SEC-06: Sanitize provider errors before showing them to users; never expose raw auth headers, keys, internal paths or stack traces.

- SEC-07: Treat model catalog metadata and upstream model cards as untrusted input; model descriptions cannot modify routing policy.

- SEC-08: Store request metadata for a configurable short retention period (default 7 days). Avoid prompt/audio/image content by default.

- SEC-09: Provide “clear diagnostics” and “remove provider key” controls; removed credentials must no longer be used by in-flight/new requests.


# 11. Non-functional requirements


| Area | Requirement / target |

| --- | --- |

| Latency | Router policy decision p95 < 50 ms excluding catalog fetch and provider request; no synchronous catalog fetch on every user request. |

| Fallback overhead | At most 2 provider switches per request by default; total response deadline configurable per task profile. |

| Availability | Registry/selection logic works from cached metadata during provider catalog outage; health state is visibly stale. |

| Privacy | No raw prompt/screen/audio retention by default; local-only mode blocks cloud routes. |

| Safety of billing | FREE_ONLY default; any paid request is rejected before dispatch; paid-mode changes require explicit confirmation. |

| Correctness | Capability and schema checks are testable and deterministic; provider-specific request bodies are covered by contract tests. |

| Maintainability | Provider adapter contract tests and one canonical schema; new provider does not require rewriting routing policy. |

| Accessibility | Keyboard-operable settings, visible status text, and errors not conveyed by color alone. |

| Portability | Configuration export excludes secrets by default; registry and route profiles are versioned. |




# 12. Acceptance criteria


- AC-01: When FREE_ONLY is enabled, an eligible-free request never dispatches to a PAID, PROMO_CREDIT or UNKNOWN endpoint, even if all free providers fail.

- AC-02: Refreshing catalogs adds newly discovered models as candidates; it does not automatically enable unprobed models.

- AC-03: If the selected provider returns 429, router respects Retry-After/reset metadata or switches to an independent eligible provider without exceeding retry limits.

- AC-04: An authentication/model-not-found/invalid-request error is not retried against the same model unchanged.

- AC-05: A screenshot request never reaches a model lacking verified image input.

- AC-06: A local-only request produces zero cloud adapter invocations in automated tests.

- AC-07: Retired IDs in the known deprecated list are disabled or shown as deprecated; missing IDs from a live catalog are flagged for review, not silently remapped.

- AC-08: User can inspect provider, model ID, fallback count, error class and reason for final selection without exposing prompt content.

- AC-09: Logs contain no API keys, authorization headers, raw screen data, raw audio or prompt by default.

- AC-10: Every model shown as “free” has a dated evidence source, cost class and verification status visible in the UI.

- AC-11: Provider outage tests prove that the router uses at least one independent adapter when available.

- AC-12: A paid route can be used only after explicit ALLOW_PAID selection and a configured hard spend cap.


# 13. Metrics and experiments


| Metric | Definition | Initial target / usage |

| --- | --- | --- |

| Request success rate | Successful valid responses / user requests | Track by task profile and provider; target >95% excluding user-invalid inputs where feasible. |

| Fallback rescue rate | Requests that succeeded after first route failed / requests with fallback | Evaluate whether fallbacks help or only add latency. |

| Capability mismatch rate | Requests dispatched to an endpoint that cannot satisfy request | Target 0%. |

| Free-policy violation rate | Paid/promo/unknown requests dispatched during FREE_ONLY | Target 0%; treat any event as severity-1 defect. |

| p50/p95 latency | Request time to first token and total duration | Compare within task profile; do not rank unrelated workloads. |

| Quota waste | Daily calls lost to avoidable retries or invalid IDs | Target trend downward; monitor 429 and 400/404 patterns. |

| Stale model rate | Active models with stale catalog/probe evidence | Set TTL by provider; surface stale metadata. |

| Quality score | User feedback + curated task benchmark outcome | Roll out model candidates only when quality/latency/cost tradeoff is favorable. |




# 14. Delivery plan


| Phase | Scope | Exit criteria |

| --- | --- | --- |

| Phase 0 — Correctness (P0) | Remove decommissioned Groq Llama IDs from default routes; gate paid/promotional providers; clean up Gemini 2.0 legacy fallback; add bounded retries and capability checks. | Regression tests pass; free-only cannot spend; vision/STT tasks reject unsupported routes. |

| Phase 1 — Registry & diagnostics | Canonical schema; OpenRouter + Gemini + Groq catalog sync; status dashboard; model smoke tests; observability redaction. | Active catalog differences visible; every active route has dated evidence. |

| Phase 2 — Expand free providers | Add Cloudflare Workers AI; add Ollama/local adapter health checks; integrate HF as exploration credits; add OpenRouter free candidates and reviews. | New providers are behind feature flags until test suite + privacy review pass. |

| Phase 3 — Quality-aware routing | Add task profiles, health/latency ranking, quota tracking, circuit breakers, request traces and benchmark harness. | Routing decisions are reproducible and explainable; provider outage scenario tested. |

| Phase 4 — Advanced discovery | Research integrations for NVIDIA NIM, SambaNova, Mistral, GitHub Models, Alibaba Model Studio and additional OpenAI-compatible gateways. | Each integration has current official terms, limits, adapter tests, and privacy classification. |




# 15. Engineering implementation notes



## Suggested module ownership


| Module | Responsibility |

| --- | --- |

| `providerRegistry.ts` | Provider metadata, enabled state, adapter factory, cost/data policies. |

| `modelCatalogSync.ts` | Catalog polling, normalization, diffing, stale-state detection. |

| `modelRegistryStore.ts` | Persistence for models, health history, quotas and user preferences. |

| `capabilityResolver.ts` | Hard-filter candidates against text/image/audio/video/tools/JSON/context requirements. |

| `routingPolicy.ts` | Task profiles, candidate score, user pinning and policy constraints. |

| `fallbackOrchestrator.ts` | Bounded failover, error mapping, retry-after, circuit breakers and deadline. |

| `providerAdapters/*` | Provider-specific invocation, payload formats, model listing, usage and error normalization. |

| `privacyPolicy.ts` | Free-only, local-only, data-use and redaction enforcement. |

| `healthChecks.ts` | Tiny non-sensitive probes and per-capability smoke tests. |

| `diagnostics.ts` | Structured, redacted routing trace and operational metrics. |




## Suggested default configuration


```yaml
routing:
  billingMode: FREE_ONLY
  privacyMode: STANDARD          # STANDARD | SENSITIVE | LOCAL_ONLY
  maxProviderSwitches: 2
  requestDeadlineMs:
    fast_text: 12000
    general: 30000
    reasoning: 90000
    vision: 30000
    transcription: 60000
catalog:
  syncIntervalHours: 24
  requireProbeForAutoRouting: true
  staleAfterHours: 72
retry:
  maxAttemptsPerProvider: 1
  respectRetryAfter: true
  circuitBreakerFailures: 3
  circuitCooldownSeconds: 60
logging:
  retainDays: 7
  logPrompts: false
  logImages: false
  logAudio: false
```


# 16. Risks and mitigations


| Risk | Impact | Mitigation |

| --- | --- | --- |

| Free endpoint becomes unavailable | Request failures and queue exhaustion. | Multiple independent providers, health probes, bounded fallback and local option. |

| Free-tier terms change | Unexpected blocked requests, privacy or bill exposure. | Daily/periodic metadata sync, conservative UNKNOWN class, dated terms and explicit paid gating. |

| False capability metadata | Broken vision, audio, JSON or tools. | Capability smoke tests, contract tests and separate capability flags. |

| Quota exhaustion across one account | All models under a provider may fail. | Provider-level quota circuit, reset-aware cooldown, independent provider routing. |

| Privacy exposure through a free model | Sensitive content may be retained or used for training. | Data-use classification, private-mode exclusions, warnings and local-only enforcement. |

| Context limit overestimated | Truncation, errors, high latency. | Estimate actual input+output budget, keep safety margin, avoid max-context marketing assumptions. |

| Dynamic router changes underlying model | Non-reproducible output or unexpected modality. | Trace actual model/provider, pin critical workflows, post-validate output. |

| Registry complexity grows unchecked | More maintenance than value. | Candidate queue, adapter contract tests and prune models with low use or poor success. |




# 17. Open decisions


- OD-01: Is the product desktop-only, web-only, or both? This affects secret storage and local-only guarantees.

- OD-02: Where is the registry persisted: local SQLite, browser IndexedDB, or a backend database? Recommendation: SQLite/local backend for desktop; backend database for multi-device cloud application.

- OD-03: Should candidate model probing run automatically or only with user approval? Recommendation: auto-run minimal non-sensitive probes for public providers; require approval for new privacy policies or promo-credit providers.

- OD-04: Should prompt/response caching be enabled? Recommendation: disabled for sensitive/private mode, opt-in elsewhere with retention and keying rules.

- OD-05: Which task profiles require tool calling or computer use? These capabilities require additional threat modeling and must not be inferred from model compatibility alone.


# 18. Research sources


Sources below were checked for this PRD snapshot. Rates and IDs may change; the product must preserve source URL and retrieval timestamp in the registry. Direct API probes and the user’s account-specific quota page remain the final authority for availability.

- [1] OpenRouter — Free model collection (live rankings, IDs, model descriptions, published free prices). [https://openrouter.ai/collections/free-models](https://openrouter.ai/collections/free-models)

- [2] OpenRouter — Pricing and plan limits (free-model RPM/RPD and plan details). [https://openrouter.ai/pricing/](https://openrouter.ai/pricing/)

- [3] OpenRouter — Model fallbacks documentation. [https://openrouter.ai/docs/guides/routing/model-fallbacks](https://openrouter.ai/docs/guides/routing/model-fallbacks)

- [4] Google — Gemini API model catalog and deprecation state. [https://ai.google.dev/gemini-api/docs/models](https://ai.google.dev/gemini-api/docs/models)

- [5] Google — Gemini API pricing and free-tier table. [https://ai.google.dev/gemini-api/docs/pricing](https://ai.google.dev/gemini-api/docs/pricing)

- [6] Groq — Supported models and active model catalog endpoint. [https://console.groq.com/docs/models](https://console.groq.com/docs/models)

- [7] Groq — Model deprecation schedule (Llama 3.1 8B Instant and Llama 3.3 70B Versatile shutdowns). [https://console.groq.com/docs/deprecations](https://console.groq.com/docs/deprecations)

- [8] Groq — Rate limits and free-plan quotas. [https://console.groq.com/docs/rate-limits](https://console.groq.com/docs/rate-limits)

- [9] Cloudflare — Workers AI pricing (updated 1 October 2026; 10,000 Neurons/day free allocation). [https://developers.cloudflare.com/workers-ai/platform/pricing/](https://developers.cloudflare.com/workers-ai/platform/pricing/)

- [10] Hugging Face — Inference Providers pricing ($0.10/month Free-user credits, subject to change). [https://huggingface.co/docs/inference-providers/pricing](https://huggingface.co/docs/inference-providers/pricing)

- [11] Cerebras — Inference pricing (developer tier and one-time $5 promotional credit terms). [https://www.cerebras.ai/pricing](https://www.cerebras.ai/pricing)

- [12] Ollama — Local model library and downloads. [https://ollama.com/library](https://ollama.com/library)

- [13] Cloudflare — Workers AI model catalog. [https://developers.cloudflare.com/workers-ai/models/](https://developers.cloudflare.com/workers-ai/models/)

- [14] OpenRouter — Public API reference / catalog discovery entry point. [https://openrouter.ai/docs/api-reference/list-available-models](https://openrouter.ai/docs/api-reference/list-available-models)


# Appendix A. Immediate implementation checklist


- [ ] Disable Groq Llama 3.1 8B Instant and Llama 3.3 70B Versatile in the free/developer fallback chain.

- [ ] Remove Gemini 2.0 Flash experimental endpoint from default fallback; keep only if separate OpenRouter endpoint probe succeeds and policy approves.

- [ ] Introduce `FREE_ONLY` as a server-side policy default; block PAID, PROMO_CREDIT and UNKNOWN routes before dispatch.

- [ ] Add normalized provider/model records and live catalog sync for OpenRouter, Google and Groq.

- [ ] Add capability checks and model smoke probes for vision, transcription, JSON schema and tools.

- [ ] Add bounded retries, Retry-After handling and circuit breakers.

- [ ] Add Cloudflare Workers AI adapter behind a feature flag; implement quota tracking.

- [ ] Add Ollama health check and local-only route enforcement.

- [ ] Add free-model discovery page with model IDs, cost class, source URL, privacy note and last-checked timestamp.

- [ ] Add automated tests for paid-call blocking, private-mode cloud blocking, unsupported vision, invalid model ID and quota exhaustion.

End of document.
