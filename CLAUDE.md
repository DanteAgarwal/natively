# Natively (project)

This is an Electron + React + TypeScript desktop app ("Natively") for real-time meeting/interview assistance. It overlays on screen, captures audio, transcribes via STT, and provides AI-powered answer suggestions.

## Repo layout
- `electron/` — Electron main process: windows, IPC handlers, audio capture, STT providers, local DB/RAG, credentials.
- `src/` — Vite/React renderer UI (overlay, settings, dashboard).
- `renderer/` — an additional CRA-based renderer (appears legacy/unused vs `src/`).
- `native-module/` — Rust N-API module (`natively-audio`) for system audio + mic capture.
- `assets/` — icons and media.

## Build rules — CRITICAL
- **NEVER run `npm run build`** — it wipes `dist-electron/` via `rimraf dist dist-electron` first, destroying all compiled output.
- **Electron changes**: edit TypeScript source in `electron/`, compile with `npx tsc -p electron/tsconfig.json`. Output goes to `dist-electron/`.
- **Renderer changes** (React/src/): `npx vite build`. Output goes to `dist/`.
- **After any change**: kill ALL electron processes (`taskkill //F //IM "electron.exe"`) and relaunch. Electron caches JS modules — closing the window is NOT enough.
- Never edit `dist-electron/` directly — changes get overwritten on next compile.

## LLM routing — how it works
- **CLIProxy**: OpenAI-compatible proxy. Endpoint + API key read from env (`CLIPROXY_BASE_URL`, `CLIPROXY_API_KEY` — see `.env.example`). All Claude calls go through this. Wired up in `LLMHelper.ts` constructor as `cliproxyClient`.
- **Model constant**: `CLAUDE_MODEL = "claude-sonnet-4-6"` in `LLMHelper.ts`.
- **Model routing** (in `streamChat()`): checks `currentModelId?.startsWith('claude-')` to catch any claude variant (UI stores `claude-sonnet-4-5` but proxy uses `claude-sonnet-4-6`).
- **NEVER route API calls directly to Anthropic**. Always use CLIProxy.

## Prompt architecture — three code paths
When the user interacts, different prompts are used depending on HOW:

| User action | Prompt used | File |
|---|---|---|
| Types in text box + Enter | `CLAUDE_SYSTEM_PROMPT` | `electron/llm/prompts.ts` |
| Clicks "What to answer?" button | `UNIVERSAL_WHAT_TO_ANSWER_PROMPT` | `electron/llm/prompts.ts` |
| Screenshot analysis | `CLAUDE_SYSTEM_PROMPT` (via `analyzeImageFile`) | `electron/LLMHelper.ts` |
| Mic transcript → "What to answer?" | `UNIVERSAL_WHAT_TO_ANSWER_PROMPT` via `WhatToAnswerLLM` | `electron/llm/WhatToAnswerLLM.ts` |

**If you change prompt behavior, you must update BOTH `CLAUDE_SYSTEM_PROMPT` and `UNIVERSAL_WHAT_TO_ANSWER_PROMPT`** — they serve different input paths but need identical formatting rules.

## Intent classifier — can override prompts
`electron/llm/IntentClassifier.ts` runs BEFORE the LLM call for "What to answer?" button. It injects `<intent_and_shape>` block into the user message with `ANSWER SHAPE` instructions. If the answer shape conflicts with the system prompt format, the model follows the answer shape.

- The `coding` intent shape was changed to defer to TYPE E format from the system prompt (not its own format).
- If you add new prompt formats, check that IntentClassifier shapes don't conflict.

## Prompt format — 💬 SAY / ⚡ DO
For implementation/coding tasks, the prompt uses TYPE E format:

```
💬 SAY: [2-3 sentences describing approach, no code]

⚡ DO:
1. Press Ctrl+` to open terminal...
2. In the terminal, type: mkdir -p internal\middleware — press Enter.
3. In the terminal, type: type nul > internal\middleware\auth.go — press Enter.
4. Press Ctrl+P. Type: internal/middleware/auth.go — press Enter.
5. Paste this entire code: [code block]. Press Ctrl+S.
```

**Rules for ⚡ DO steps** (user is non-technical):
- Every step = exact physical action (what to press, what to type)
- NEVER write "Create new file →", "Open →", "Add the dependency" — these are not steps
- Creating new files: `type nul > path\file.go` (Windows) BEFORE `Ctrl+P` — Ctrl+P can only open existing files
- Always end file edits with "Press Ctrl+S"
- Terminal commands: "In the terminal, type: [exact command] — press Enter."

## candidate_context.md — interview prep
- Lives at project root: `candidate_context.md`
- Loaded at runtime by `loadCandidateContext()` in `prompts.ts`
- Contains: candidate identity, skills, assignment deep-dive, prepared answers, interviewer panel info
- Injected into every prompt via `CANDIDATE_CONTEXT_BLOCK`
- **VOICE RULE**: all answers must be first-person ("I built...", "I'd use...")
- **ANTI-HALLUCINATION**: never invent projects/metrics not in the document
- For new jobs: create a new `candidate_context.md` following the same structure (Identity → Skills → Assignment deep-dive → Known weaknesses → Prepared answers → Interviewer context)

## Ghost mode / Undetectable
- Toggle: "Undetectable" in overlay settings → calls `setUndetectable(state)` in `main.ts`
- Uses `setContentProtection(true)` on all windows (overlay, launcher, settings)
- **Defaults to ON** (`isUndetectable: boolean = true` in `main.ts`)
- Applied at startup via `appState.setUndetectable(true)` in the ready handler
- **Works in Chrome** screen share (Google Meet). Does NOT work in Firefox.
- **Screenshot behavior**: when undetectable is ON, screenshots do NOT hide/show the window (no flash). Content protection already excludes the window from capture.
- **Known issue**: CSS dropdowns/popups that overflow the overlay window bounds create separate native child windows that are NOT protected. Don't open model picker during screen share.

## Screenshot analysis
- Triggered by Ctrl+H (full) or Ctrl+Shift+H (selective)
- `analyzeImageFile()` in `LLMHelper.ts` routes through CLIProxy (Claude), NOT Gemini
- Image is processed via `sharp` (resized to 1536px, JPEG 80%)
- Sent as base64 `image_url` in OpenAI-compatible multimodal message
- Uses `CLAUDE_SYSTEM_PROMPT` as system prompt so TYPE A/B format rules apply

## Conversation memory
- `NativelyInterface.tsx` builds `conversationContext` from last 20 messages
- Includes ALL messages (screenshot analyses, user messages, assistant responses)
- Passed as `context` parameter to `streamGeminiChat` → prepended as `CONTEXT:\n{history}\n\nUSER QUESTION:\n{message}`
- `CLAUDE_SYSTEM_PROMPT` has CONVERSATION MEMORY RULE: recent context takes priority over prepared reference material

## Screenshot capture — CRITICAL
- Uses Electron `desktopCapturer` API (built-in, no external scripts)
- **NEVER use `screenshot-desktop` npm package** — its PowerShell .bat script fails silently on Windows
- When undetectable/ghost mode is ON, screenshots do NOT hide/show the window (no flash)
- `ScreenshotHelper.ts` → `desktopCapturer.getSources({ types: ['screen'] })` → `thumbnail.toPNG()`
- **NEVER recompile (`npx tsc`) without verifying all pending TS changes** — recompiling applies ALL uncommitted changes, which can break working features

## Audio capture — known issues
- System audio uses WASAPI loopback (Windows) via Rust native module
- Captures from the **default multimedia output device** only (not communications device)
- Google Meet uses the Windows **communications** device which can be different → Meet audio may not be captured
- Fix for interviews: ensure Windows default output and default communications device are the same
- `native-module/src/speaker/windows.rs` line 137: `get_default_device(&Direction::Render)` — this gets multimedia default, not communications
- Future fix: capture from communications device too, or allow selecting device

## Key subsystems
- Audio capture:
  - System: `electron/audio/SystemAudioCapture.ts` (lazy init of Rust capture)
  - Mic: `electron/audio/MicrophoneCapture.ts` (eager init)
- STT:
  - Deepgram WebSocket streaming: `electron/audio/DeepgramStreamingSTT.ts`
  - REST batch upload (Groq/OpenAI/ElevenLabs/Azure/IBM): `electron/audio/RestSTT.ts`
  - Google streaming: `electron/audio/GoogleSTT.ts`
- Credentials:
  - `electron/services/CredentialsManager.ts` stores keys in `app.getPath('userData')/credentials.enc` using `safeStorage` (with plaintext fallback).
- IPC boundary:
  - `electron/ipcHandlers.ts` exposes key management + STT provider selection to the renderer via `electron/preload.ts`.
- Window management:
  - `electron/WindowHelper.ts` — overlay/launcher creation, show/hide, ghost mode, setBounds
  - `electron/ScreenshotHelper.ts` — screenshot capture with hide/show callbacks
  - `electron/main.ts` — app state, screenshot orchestration, undetectable mode

## Black-screen bug — KNOWN issue + fix (2026-04-23)
**Symptom**: launcher window renders fully black on cold start. Title bar visible, content empty. Log shows "loadURL success" with no crash.

**Root cause**: NOT GPU. Chromium HTTP/1.1 socket pool exhaustion (~6 conn/host) when Vite dev server dumps 150+ pre-bundled dep chunk requests in parallel. Failed chunks → `main.tsx` imports never resolve → React never mounts. Error in renderer console: `net::ERR_INSUFFICIENT_RESOURCES`.

**Permanent fix (two layers — both must be present):**
1. **`index.html`** — inline script after `<script src="/src/main.tsx">` auto-reloads once (sessionStorage-guarded) if `#root` has 0 children after 1.8s. Second load hits warm module cache → chunks succeed.
2. **`dist-electron/main.js`** — `render-process-gone` handler calls `webContents.reload()` up to 2 times per webContents (covers OOM / stack overflow variants).

**If fix disappears after TS recompile (`npx tsc`)**: restore both layers from [auto-memory note](../../memory/project_natively_gpu_fix.md). TS source versions should mirror the JS patches in `electron/main.ts` at module scope and `index.html` at repo root.

**Do NOT "fix" by**: disabling content protection on launcher, disabling GPU/hardware acceleration, opening DevTools on startup, clearing GPUCache. Those are symptom-chasing — they don't address the socket-pool exhaustion.

**Stronger future fix**: `npx vite build` → `dist/`, load `dist/index.html` even in dev. Produces 2-3 bundled chunks instead of 150+. Loses HMR but eliminates the class of bug.

## Hygiene
- Do not read/print `.env` contents.
- Avoid touching `node_modules/` and Rust `target/` unless explicitly requested.
- Keep changes scoped to the requested bugs.
- After changes: always `npx tsc -p electron/tsconfig.json` for electron, `npx vite build` for renderer.
- Always kill all electron processes before relaunching.
