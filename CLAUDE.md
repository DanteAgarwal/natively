# Ghost AI Copilot (Natively)

Ghost AI is an ultra-fast, invisible desktop copilot built with Electron, React, and TypeScript. It features OS-level screen protection (anti-screenshot/invisible during screen shares), instant screen analysis, hotkeys, and streaming AI responses with Google Gemini and Groq Cloud.

## Repo Layout
- `electron/` — Electron main process:
  - `main.ts` — Window management, system tray, global shortcuts, IPC dispatcher.
  - `preload.ts` — Secure contextBridge exposing `window.ghostAPI`.
  - `geminiService.ts` — Google Gemini SDK integration (Gemini 3.8 Flash, multimodal screen vision, 0-budget instant streaming).
  - `groqService.ts` — Groq Cloud SDK integration (Llama 3.3 70B, Llama 3.1 8B, DeepSeek R1 Distill at 300+ tok/s).
  - `screenshotService.ts` — In-memory screen capture via Electron `desktopCapturer`.
  - `storeService.ts` — Persistent configuration storage with `electron-store`.
  - `tsconfig.json` — Electron TypeScript configuration.
- `src/` — Vite + React renderer UI:
  - `App.tsx` — Glassmorphism overlay copilot interface with chat, vision preview, and settings.
  - `components/MarkdownRenderer.tsx` — Fast Markdown rendering with syntax highlighting and code copy.
  - `main.tsx` — React root mount.
  - `index.css` — Tailwind CSS & theme tokens.
  - `vite-env.d.ts` — TypeScript declarations for `window.ghostAPI`.
- `assets/` — Application packaging icons and assets.

## Commands
- **Start Dev Environment**: `npm start` or `npm run dev` (starts Vite on port 5180 and launches Electron).
- **Build Electron**: `npm run build:electron` (`tsc -p electron/tsconfig.json`).
- **Build UI**: `npm run build:ui` (`vite build`).
- **Full Build**: `npm run build`.

## AI Providers
- **Google Gemini**:
  - Models: `gemini-3.8-flash` (flagship default for vision & multimodal), `gemini-3.5-flash-lite`, `gemini-3.7-flash`, `gemini-3.6-flash`.
  - Built-in multi-model fault tolerance: Automatically fails over across active Gemini models on 429 quota exhaustion or transient server outages.
  - Native multimodal vision support for instant screenshot analysis.
- **Groq Cloud ⚡**:
  - Key format: `gsk_...`
  - Models: `llama-3.3-70b-versatile` (flagship reasoning), `deepseek-r1-distill-qwen-32b` (deep reasoning), `qwen-2.5-coder-32b` (coding specialist), `openai/gpt-oss-120b`, `openai/gpt-oss-20b` (ultra-fast).
  - Built-in multi-model fault tolerance: Automatically fails over to healthy models on rate limits (429), decommissioned IDs (404/400), or server outages.
  - Screen captures seamlessly route to Gemini Vision if a Gemini key is available.
- **OpenRouter 🌐 (Free Models)**:
  - Key format: `sk-or-v1-...`
  - Models: `openrouter/free` (auto-router), `google/gemini-2.0-flash-exp:free` (vision enabled), `meta-llama/llama-3.3-70b-instruct:free`, `deepseek/deepseek-r1:free`, `qwen/qwen-2.5-coder-32b-instruct:free`, `mistralai/mistral-7b-instruct:free`, `deepseek/deepseek-chat:free`, `google/gemini-2.0-pro-exp-02-05:free`.
  - 100% Free tokens: All `:free` models cost $0.00. Automatic fault-tolerant failover across free models on rate limits or outages.
  - Native multimodal screen vision support via Gemini 2.0 Flash Free or automatic vision routing.
- **Free Router 🔀 (Universal / Zero-Key Gateway)**:
  - Presets:
    - **Pollinations AI**: 100% Free public router with NO API key required.
    - **Cerebras Cloud**: 2,000+ tokens/sec ultra-fast free tier.
    - **Ollama**: Local offline private inference with zero token cost.
    - **DeepInfra**: Free tier models.
    - **Custom Router**: Any OpenAI-compatible proxy (LiteLLM, vLLM, Bifrost).
  - Configurable Base URL, API key, and model name with live connection testing.

## Key Shortcuts
- **Toggle Visibility**: `Cmd/Ctrl + \`
- **Capture & Analyze Screen**: `Cmd/Ctrl + Shift + S`
- **Click-Through Mode (Pass clicks)**: `Cmd/Ctrl + Shift + X`
- **Emergency Panic Hide**: `Cmd/Ctrl + Shift + H` or `Escape`
