import React from 'react';
import { Settings, X, ExternalLink, Loader2, Check, Briefcase, ChevronRight, Headphones } from 'lucide-react';
import { AppConfig } from '../types/config';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: AppConfig;
  setConfig: React.Dispatch<React.SetStateAction<AppConfig>>;
  onSave: () => void;
  saveSuccess: boolean;
  onOpenContextModal: () => void;
  audioDevices: { inputs: Array<{ id: string; name: string }>; outputs: Array<{ id: string; name: string }> };
  selectedOutputDevice: string;
  setSelectedOutputDevice: (id: string) => void;
  testStatus: { testing: boolean; success?: boolean; error?: string };
  onTestKey: (provider?: 'gemini' | 'groq' | 'openrouter' | 'router') => Promise<void>;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  config,
  setConfig,
  onSave,
  saveSuccess,
  onOpenContextModal,
  audioDevices,
  selectedOutputDevice,
  setSelectedOutputDevice,
  testStatus,
  onTestKey,
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto py-4 px-4"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-sm rounded-2xl p-5 space-y-4 my-auto"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'rgba(14,15,20,0.98)',
          border: '1px solid rgba(255,255,255,0.1)',
          boxShadow: '0 32px 80px rgba(0,0,0,0.9)',
          maxHeight: '90vh',
          overflowY: 'auto',
          scrollbarWidth: 'thin',
          scrollbarColor: 'rgba(255,255,255,0.1) transparent',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <h3 className="text-sm font-semibold flex items-center gap-2" style={{ color: 'white' }}>
            <Settings className="w-4 h-4" style={{ color: '#3b82f6' }} />
            Settings
          </h3>
          <button onClick={onClose} style={{ color: 'rgba(255,255,255,0.4)' }}>
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Provider Switcher */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium" style={{ color: 'rgba(255,255,255,0.7)' }}>AI Cloud Provider & Router</label>
          <div className="grid grid-cols-2 gap-1 rounded-xl p-1" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <button
              type="button"
              onClick={() => setConfig({ ...config, provider: 'gemini' })}
              className={`py-1.5 px-2 rounded-lg text-xs font-medium transition-all text-center ${config.provider === 'gemini'
                ? 'bg-blue-600 text-white shadow font-semibold'
                : 'text-white/40 hover:text-white/70'
                }`}
            >
              Google Gemini
            </button>
            <button
              type="button"
              onClick={() => setConfig({ ...config, provider: 'groq' })}
              className={`py-1.5 px-2 rounded-lg text-xs font-medium transition-all text-center ${config.provider === 'groq'
                ? 'bg-orange-600 text-white shadow font-semibold'
                : 'text-white/40 hover:text-white/70'
                }`}
            >
              Groq Cloud ⚡
            </button>
            <button
              type="button"
              onClick={() => setConfig({ ...config, provider: 'openrouter' })}
              className={`py-1.5 px-2 rounded-lg text-xs font-medium transition-all text-center ${config.provider === 'openrouter'
                ? 'bg-purple-600 text-white shadow font-semibold'
                : 'text-white/40 hover:text-white/70'
                }`}
            >
              OpenRouter 🌐 (Free)
            </button>
            <button
              type="button"
              onClick={() => setConfig({ ...config, provider: 'router' })}
              className={`py-1.5 px-2 rounded-lg text-xs font-medium transition-all text-center ${config.provider === 'router'
                ? 'bg-emerald-600 text-white shadow font-semibold'
                : 'text-white/40 hover:text-white/70'
                }`}
            >
              Free Router 🔀
            </button>
          </div>
        </div>

        {/* Provider-specific Key & Model */}
        {config.provider === 'gemini' && (
          <>
            {/* Gemini API Key */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium" style={{ color: 'rgba(255,255,255,0.7)' }}>
                  Google Gemini API Key
                </label>
                <a
                  href="https://aistudio.google.com/app/apikey"
                  target="_blank"
                  rel="noreferrer"
                  className="text-[10px] flex items-center gap-0.5 hover:underline"
                  style={{ color: '#60a5fa' }}
                >
                  Get free key <ExternalLink className="w-2.5 h-2.5" />
                </a>
              </div>
              <input
                type="password"
                value={config.geminiApiKey}
                onChange={(e) => setConfig({ ...config, geminiApiKey: e.target.value })}
                placeholder="AIzaSy..."
                className="w-full rounded-lg px-3 py-2 text-xs outline-none font-mono transition-all"
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: 'white',
                }}
              />
              <div className="flex items-center justify-between pt-0.5">
                <button
                  onClick={() => onTestKey('gemini')}
                  disabled={testStatus?.testing || !config.geminiApiKey.trim()}
                  className="text-[11px] px-2.5 py-1 rounded-lg transition-all disabled:opacity-40"
                  style={{
                    background: 'rgba(255,255,255,0.05)',
                    color: 'rgba(255,255,255,0.6)',
                    border: '1px solid rgba(255,255,255,0.08)',
                  }}
                >
                  {testStatus?.testing ? (
                    <span className="flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" />Testing...</span>
                  ) : 'Test Key'}
                </button>
                {testStatus?.success === true && (
                  <span className="text-[11px] flex items-center gap-1" style={{ color: '#34d399' }}>
                    <Check className="w-3 h-3" /> Valid API key
                  </span>
                )}
                {testStatus?.success === false && (
                  <span className="text-[11px] max-w-[200px] truncate" style={{ color: '#f87171' }} title={testStatus.error || 'Test failed'}>
                    {testStatus.error || 'Test failed'}
                  </span>
                )}
              </div>
            </div>

            {/* Gemini Model */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium" style={{ color: 'rgba(255,255,255,0.7)' }}>Active Model</label>
              <select
                value={config.model}
                onChange={(e) => setConfig({ ...config, model: e.target.value })}
                className="w-full rounded-xl px-3 py-2.5 text-xs font-medium outline-none cursor-pointer border border-zinc-700/80 bg-zinc-900 text-zinc-100 hover:border-zinc-500 focus:border-blue-500 shadow-md transition-colors"
                style={{
                  backgroundColor: '#18181b',
                  color: '#f4f4f5',
                  colorScheme: 'dark',
                }}
              >
                <option value="gemini-3.8-flash" className="bg-zinc-900 text-zinc-100 py-2" style={{ backgroundColor: '#18181b', color: '#f4f4f5' }}>gemini-3.8-flash — Flagship Intelligence & Vision ⚡ (Free)</option>
                <option value="gemini-3.5-flash-lite" className="bg-zinc-900 text-zinc-100 py-2" style={{ backgroundColor: '#18181b', color: '#f4f4f5' }}>gemini-3.5-flash-lite — Ultra Fast & Lightweight 🚀 (Free)</option>
                <option value="gemini-3.7-flash" className="bg-zinc-900 text-zinc-100 py-2" style={{ backgroundColor: '#18181b', color: '#f4f4f5' }}>gemini-3.7-flash — Fast Coding & Agents (Free)</option>
                <option value="gemini-3.6-flash" className="bg-zinc-900 text-zinc-100 py-2" style={{ backgroundColor: '#18181b', color: '#f4f4f5' }}>gemini-3.6-flash — Balanced Multimodal (Free)</option>
              </select>
            </div>
          </>
        )}

        {config.provider === 'groq' && (
          <>
            {/* Groq API Key */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium" style={{ color: 'rgba(255,255,255,0.7)' }}>
                  Groq API Key
                </label>
                <a
                  href="https://console.groq.com/keys"
                  target="_blank"
                  rel="noreferrer"
                  className="text-[10px] flex items-center gap-0.5 hover:underline"
                  style={{ color: '#fb923c' }}
                >
                  Get free key <ExternalLink className="w-2.5 h-2.5" />
                </a>
              </div>
              <input
                type="password"
                value={config.groqApiKey}
                onChange={(e) => setConfig({ ...config, groqApiKey: e.target.value })}
                placeholder="gsk_..."
                className="w-full rounded-lg px-3 py-2 text-xs outline-none font-mono transition-all"
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: 'white',
                }}
              />
              <div className="flex items-center justify-between pt-0.5">
                <button
                  onClick={() => onTestKey('groq')}
                  disabled={testStatus?.testing || !config.groqApiKey.trim()}
                  className="text-[11px] px-2.5 py-1 rounded-lg transition-all disabled:opacity-40"
                  style={{
                    background: 'rgba(255,255,255,0.05)',
                    color: 'rgba(255,255,255,0.6)',
                    border: '1px solid rgba(255,255,255,0.08)',
                  }}
                >
                  {testStatus?.testing ? (
                    <span className="flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" />Testing...</span>
                  ) : 'Test Key'}
                </button>
                {testStatus?.success === true && (
                  <span className="text-[11px] flex items-center gap-1" style={{ color: '#34d399' }}>
                    <Check className="w-3 h-3" /> Valid Groq key
                  </span>
                )}
                {testStatus?.success === false && (
                  <span className="text-[11px] max-w-[200px] truncate" style={{ color: '#f87171' }} title={testStatus.error || 'Test failed'}>
                    {testStatus.error || 'Test failed'}
                  </span>
                )}
              </div>
            </div>

            {/* Groq Model */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium" style={{ color: 'rgba(255,255,255,0.7)' }}>Active Model</label>
              <select
                value={config.groqModel}
                onChange={(e) => setConfig({ ...config, groqModel: e.target.value })}
                className="w-full rounded-xl px-3 py-2.5 text-xs font-medium outline-none cursor-pointer border border-zinc-700/80 bg-zinc-900 text-zinc-100 hover:border-zinc-500 focus:border-orange-500 shadow-md transition-colors"
                style={{
                  backgroundColor: '#18181b',
                  color: '#f4f4f5',
                  colorScheme: 'dark',
                }}
              >
                <option value="llama-3.3-70b-versatile" className="bg-zinc-900 text-zinc-100 py-2" style={{ backgroundColor: '#18181b', color: '#f4f4f5' }}>llama-3.3-70b-versatile — Flagship Reasoning & Coding (280 tok/s) ⚡</option>
                <option value="llama-3.1-8b-instant" className="bg-zinc-900 text-zinc-100 py-2" style={{ backgroundColor: '#18181b', color: '#f4f4f5' }}>llama-3.1-8b-instant — Ultra-Fast Lightweight Model (~560 tok/s, 20k TPM) 🚀</option>
                <option value="openai/gpt-oss-120b" className="bg-zinc-900 text-zinc-100 py-2" style={{ backgroundColor: '#18181b', color: '#f4f4f5' }}>openai/gpt-oss-120b — Flagship 120B Reasoning & Code 🧠</option>
                <option value="openai/gpt-oss-20b" className="bg-zinc-900 text-zinc-100 py-2" style={{ backgroundColor: '#18181b', color: '#f4f4f5' }}>openai/gpt-oss-20b — Ultra-Fast 20B Reasoning ⚡</option>
              </select>
            </div>
          </>
        )}

        {config.provider === 'openrouter' && (
          <>
            {/* OpenRouter API Key */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium" style={{ color: 'rgba(255,255,255,0.7)' }}>
                  OpenRouter API Key
                </label>
                <a
                  href="https://openrouter.ai/keys"
                  target="_blank"
                  rel="noreferrer"
                  className="text-[10px] flex items-center gap-0.5 hover:underline"
                  style={{ color: '#c084fc' }}
                >
                  Get free key <ExternalLink className="w-2.5 h-2.5" />
                </a>
              </div>
              <input
                type="password"
                value={config.openrouterApiKey}
                onChange={(e) => setConfig({ ...config, openrouterApiKey: e.target.value })}
                placeholder="sk-or-v1-..."
                className="w-full rounded-lg px-3 py-2 text-xs outline-none font-mono transition-all"
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: 'white',
                }}
              />
              <div className="flex items-center justify-between pt-0.5">
                <button
                  onClick={() => onTestKey('openrouter')}
                  disabled={testStatus?.testing || !config.openrouterApiKey.trim()}
                  className="text-[11px] px-2.5 py-1 rounded-lg transition-all disabled:opacity-40"
                  style={{
                    background: 'rgba(255,255,255,0.05)',
                    color: 'rgba(255,255,255,0.6)',
                    border: '1px solid rgba(255,255,255,0.08)',
                  }}
                >
                  {testStatus?.testing ? (
                    <span className="flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" />Testing...</span>
                  ) : 'Test Key'}
                </button>
                {testStatus?.success === true && (
                  <span className="text-[11px] flex items-center gap-1" style={{ color: '#34d399' }}>
                    <Check className="w-3 h-3" /> Valid OpenRouter key
                  </span>
                )}
                {testStatus?.success === false && (
                  <span className="text-[11px] max-w-[200px] truncate" style={{ color: '#f87171' }} title={testStatus.error || 'Test failed'}>
                    {testStatus.error || 'Test failed'}
                  </span>
                )}
              </div>
            </div>

            {/* OpenRouter Model */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium" style={{ color: 'rgba(255,255,255,0.7)' }}>Active Free Model</label>
              <select
                value={config.openrouterModel || 'openrouter/free'}
                onChange={(e) => setConfig({ ...config, openrouterModel: e.target.value })}
                className="w-full rounded-xl px-3 py-2.5 text-xs font-medium outline-none cursor-pointer border border-zinc-700/80 bg-zinc-900 text-zinc-100 hover:border-zinc-500 focus:border-purple-500 shadow-md transition-colors"
                style={{
                  backgroundColor: '#18181b',
                  color: '#f4f4f5',
                  colorScheme: 'dark',
                }}
              >
                <option value="openrouter/free" className="bg-zinc-900 text-zinc-100 py-2" style={{ backgroundColor: '#18181b', color: '#f4f4f5' }}>openrouter/free — Smart Free Auto-Router 🔀 (Recommended)</option>
                <option value="google/gemma-4-31b-it:free" className="bg-zinc-900 text-zinc-100 py-2" style={{ backgroundColor: '#18181b', color: '#f4f4f5' }}>google/gemma-4-31b-it:free — Google Vision & Reasoning (262k) 👁️⚡</option>
                <option value="google/gemma-4-26b-a4b-it:free" className="bg-zinc-900 text-zinc-100 py-2" style={{ backgroundColor: '#18181b', color: '#f4f4f5' }}>google/gemma-4-26b-a4b-it:free — Ultra-Fast Multimodal Vision (262k) 👁️🚀</option>
                <option value="nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free" className="bg-zinc-900 text-zinc-100 py-2" style={{ backgroundColor: '#18181b', color: '#f4f4f5' }}>nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free — Multimodal Reasoning (256k) 👁️🧠</option>
                <option value="nvidia/nemotron-3.5-lightning:free" className="bg-zinc-900 text-zinc-100 py-2" style={{ backgroundColor: '#18181b', color: '#f4f4f5' }}>nvidia/nemotron-3.5-lightning:free — 1M Context Ultra-Fast Engine ⚡</option>
                <option value="nvidia/nemotron-3-super-120b-a12b:free" className="bg-zinc-900 text-zinc-100 py-2" style={{ backgroundColor: '#18181b', color: '#f4f4f5' }}>nvidia/nemotron-3-super-120b-a12b:free — 120B Large Architecture & Reasoning 🔬</option>
                <option value="cohere/north-mini-code:free" className="bg-zinc-900 text-zinc-100 py-2" style={{ backgroundColor: '#18181b', color: '#f4f4f5' }}>cohere/north-mini-code:free — Coding Specialist & Architecture (256k) 💻</option>
              </select>
            </div>
          </>
        )}

        {config.provider === 'router' && (
          <>
            {/* Router Preset */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium" style={{ color: 'rgba(255,255,255,0.7)' }}>Router Provider Preset</label>
              <select
                value={config.routerPreset}
                onChange={(e) => {
                  const preset = e.target.value;
                  let baseUrl = config.routerBaseUrl;
                  let defaultModel = config.routerModel;
                  if (preset === 'pollinations') {
                    baseUrl = 'https://text.pollinations.ai/openai';
                    defaultModel = 'openai';
                  } else if (preset === 'cerebras') {
                    baseUrl = 'https://api.cerebras.ai/v1';
                    defaultModel = 'llama-3.3-70b';
                  } else if (preset === 'ollama') {
                    baseUrl = 'http://localhost:11434/v1';
                    defaultModel = 'llama3.2';
                  } else if (preset === 'deepinfra') {
                    baseUrl = 'https://api.deepinfra.com/v1/openai';
                    defaultModel = 'meta-llama/Llama-3.3-70B-Instruct';
                  }
                  setConfig({ ...config, routerPreset: preset, routerBaseUrl: baseUrl, routerModel: defaultModel });
                }}
                className="w-full rounded-xl px-3 py-2.5 text-xs font-medium outline-none cursor-pointer border border-zinc-700/80 bg-zinc-900 text-zinc-100 hover:border-zinc-500 focus:border-emerald-500 shadow-md transition-colors"
                style={{
                  backgroundColor: '#18181b',
                  color: '#f4f4f5',
                  colorScheme: 'dark',
                }}
              >
                <option value="pollinations" className="bg-zinc-900 text-zinc-100 py-2" style={{ backgroundColor: '#18181b', color: '#f4f4f5' }}>Pollinations AI — 100% Free (No API Key Required! 🎁)</option>
                <option value="cerebras" className="bg-zinc-900 text-zinc-100 py-2" style={{ backgroundColor: '#18181b', color: '#f4f4f5' }}>Cerebras Cloud — Ultra-Fast 2,000 tok/s Free Tier ⚡</option>
                <option value="ollama" className="bg-zinc-900 text-zinc-100 py-2" style={{ backgroundColor: '#18181b', color: '#f4f4f5' }}>Ollama — Local Offline 100% Free 💻</option>
                <option value="deepinfra" className="bg-zinc-900 text-zinc-100 py-2" style={{ backgroundColor: '#18181b', color: '#f4f4f5' }}>DeepInfra — Free Tier Open Weights 🌐</option>
                <option value="custom" className="bg-zinc-900 text-zinc-100 py-2" style={{ backgroundColor: '#18181b', color: '#f4f4f5' }}>Custom OpenAI-Compatible Router (LiteLLM, vLLM, etc.) 🔀</option>
              </select>
            </div>

            {/* Router Base URL */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium" style={{ color: 'rgba(255,255,255,0.7)' }}>Router Endpoint (Base URL)</label>
              <input
                type="text"
                value={config.routerBaseUrl}
                onChange={(e) => setConfig({ ...config, routerBaseUrl: e.target.value })}
                placeholder="https://..."
                className="w-full rounded-lg px-3 py-2 text-xs outline-none font-mono transition-all"
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: 'white',
                }}
              />
            </div>

            {/* API Key */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium" style={{ color: 'rgba(255,255,255,0.7)' }}>
                  API Key
                  {config.routerPreset === 'pollinations' || config.routerPreset === 'ollama' ? (
                    <span className="ml-1 text-[10px] text-emerald-400 font-normal">(Not required)</span>
                  ) : (
                    <span className="ml-1 text-[10px] text-white/30 font-normal">(if required by router)</span>
                  )}
                </label>
                {config.routerPreset === 'cerebras' && (
                  <a
                    href="https://cloud.cerebras.ai"
                    target="_blank"
                    rel="noreferrer"
                    className="text-[10px] flex items-center gap-0.5 hover:underline"
                    style={{ color: '#34d399' }}
                  >
                    Get free Cerebras key <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                )}
              </div>
              <input
                type="password"
                value={config.routerApiKey}
                onChange={(e) => setConfig({ ...config, routerApiKey: e.target.value })}
                placeholder={
                  config.routerPreset === 'pollinations'
                    ? 'Not required for Pollinations AI'
                    : config.routerPreset === 'ollama'
                      ? 'Not required for local Ollama'
                      : 'csk-... or router token'
                }
                className="w-full rounded-lg px-3 py-2 text-xs outline-none font-mono transition-all"
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: 'white',
                }}
              />
            </div>

            {/* Model Name */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium" style={{ color: 'rgba(255,255,255,0.7)' }}>Model Name</label>
              <input
                type="text"
                value={config.routerModel}
                onChange={(e) => setConfig({ ...config, routerModel: e.target.value })}
                placeholder="e.g. openai, llama-3.3-70b, llama3.2"
                className="w-full rounded-lg px-3 py-2 text-xs outline-none font-mono transition-all"
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: 'white',
                }}
              />
              <div className="flex items-center justify-between pt-0.5">
                <button
                  onClick={() => onTestKey('router')}
                  disabled={testStatus?.testing}
                  className="text-[11px] px-2.5 py-1 rounded-lg transition-all disabled:opacity-40"
                  style={{
                    background: 'rgba(255,255,255,0.05)',
                    color: 'rgba(255,255,255,0.6)',
                    border: '1px solid rgba(255,255,255,0.08)',
                  }}
                >
                  {testStatus?.testing ? (
                    <span className="flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" />Testing...</span>
                  ) : 'Test Connection'}
                </button>
                {testStatus?.success === true && (
                  <span className="text-[11px] flex items-center gap-1" style={{ color: '#34d399' }}>
                    <Check className="w-3 h-3" /> Connected to Router
                  </span>
                )}
                {testStatus?.success === false && (
                  <span className="text-[11px] max-w-[200px] truncate" style={{ color: '#f87171' }} title={testStatus.error || 'Connection failed'}>
                    {testStatus.error || 'Connection failed'}
                  </span>
                )}
              </div>
            </div>

            {/* Router Info Badge */}
            <div
              className="p-2.5 rounded-xl text-[11px] leading-relaxed"
              style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', color: '#6ee7b7' }}
            >
              {config.routerPreset === 'pollinations'
                ? '🎁 Pollinations AI requires ZERO API key and gives 100% free unlimited tokens for text and code.'
                : config.routerPreset === 'cerebras'
                  ? '⚡ Cerebras runs inference on Wafer-Scale chips at 2,000+ tokens/second with generous daily free tiers.'
                  : config.routerPreset === 'ollama'
                    ? '💻 Ollama runs 100% locally on your machine with total privacy and zero token cost.'
                    : '🔀 Any OpenAI-compatible router endpoint (LiteLLM, vLLM, Bifrost, DeepInfra) can be connected.'}
            </div>
          </>
        )}

        {/* Auto-Fallback Checkbox */}
        <div
          className="flex items-center gap-2 p-2.5 rounded-xl text-[11px]"
          style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.7)' }}
        >
          <input
            type="checkbox"
            id="autoFallbackCheck"
            checked={config.autoFallback}
            onChange={(e) => setConfig({ ...config, autoFallback: e.target.checked })}
            className="w-3.5 h-3.5 rounded accent-blue-500 cursor-pointer"
          />
          <label htmlFor="autoFallbackCheck" className="cursor-pointer select-none">
            <strong>Smart Fallback:</strong> If primary provider hits rate limits or quota, auto-fallback seamlessly without failing.
          </label>
        </div>

        {/* Candidate Persona & JD Context Card */}
        <div
          className="p-3 rounded-xl space-y-2"
          style={{
            background: config.userProfileContext?.enabled ? 'rgba(16, 185, 129, 0.08)' : 'rgba(255, 255, 255, 0.03)',
            border: config.userProfileContext?.enabled ? '1px solid rgba(16, 185, 129, 0.25)' : '1px solid rgba(255, 255, 255, 0.08)',
          }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Briefcase className="w-4 h-4 text-emerald-400" />
              <span className="text-xs font-semibold text-white">Resume, JD & Interview Persona</span>
            </div>
            {config.userProfileContext?.enabled ? (
              <span className="text-[10px] font-semibold text-emerald-400 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Active ({config.userProfileContext.audienceType})
              </span>
            ) : (
              <span className="text-[10px] text-zinc-500 font-mono">Inactive</span>
            )}
          </div>
          <p className="text-[11px] text-zinc-400 leading-relaxed">
            Provide your full resume, target job description (JD), and interviewer audience so the AI speaks directly in first-person as you, answering technical questions at the right depth.
          </p>
          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenContextModal();
            }}
            className="w-full py-1.5 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition-all text-emerald-300 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30"
          >
            <span>Configure Resume, JD & Audience Persona</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* System Instructions */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium" style={{ color: 'rgba(255,255,255,0.7)' }}>
            System Instructions
            <span className="ml-1.5 font-normal text-[10px]" style={{ color: 'rgba(255,255,255,0.3)' }}>optional</span>
          </label>
          <textarea
            rows={3}
            value={config.systemInstruction}
            onChange={(e) => setConfig({ ...config, systemInstruction: e.target.value })}
            placeholder="e.g. You are a senior software engineer. Answer concisely..."
            className="w-full rounded-lg p-2.5 text-xs outline-none resize-none transition-all"
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.1)',
              color: 'rgba(255,255,255,0.8)',
            }}
            onFocus={(e) => (e.target.style.borderColor = 'rgba(59,130,246,0.5)')}
            onBlur={(e) => (e.target.style.borderColor = 'rgba(255,255,255,0.1)')}
          />
        </div>

        {/* Temperature Slider */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium" style={{ color: 'rgba(255,255,255,0.7)' }}>Temperature</label>
            <span className="text-[11px] font-mono" style={{ color: 'rgba(255,255,255,0.4)' }}>{config.temperature ?? 0.7}</span>
          </div>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={config.temperature ?? 0.7}
            onChange={(e) => setConfig({ ...config, temperature: parseFloat(e.target.value) })}
            className="w-full h-1 appearance-none rounded cursor-pointer"
            style={{ accentColor: '#3b82f6' }}
          />
        </div>

        {/* Audio Device Configuration */}
        <div className="space-y-2 pt-1 border-t border-white/5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold flex items-center gap-1.5" style={{ color: '#f4f4f5' }}>
              <Headphones className="w-3.5 h-3.5 text-cyan-400" />
              Meeting Audio Output (Loopback)
            </label>
            <span className="text-[10px] font-mono text-cyan-400">Rust WASAPI</span>
          </div>
          <p className="text-[11px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.45)' }}>
            Select the speaker or headphone device where you hear the interviewer or meeting participants:
          </p>
          <select
            value={selectedOutputDevice}
            onChange={(e) => setSelectedOutputDevice(e.target.value)}
            className="w-full rounded-lg px-2.5 py-1.5 text-xs outline-none transition-all cursor-pointer"
            style={{
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.12)',
              color: 'white',
            }}
          >
            <option value="" className="bg-zinc-900 text-white">Default Audio Output (Auto-detect)</option>
            {audioDevices.outputs.map((dev) => (
              <option key={dev.id} value={dev.id} className="bg-zinc-900 text-white">
                {dev.name}
              </option>
            ))}
          </select>
        </div>

        {/* Ghost Mode Info Box */}
        <div
          className="p-3 rounded-xl text-[11px] leading-relaxed"
          style={{ background: 'rgba(16,185,129,0.07)', border: '1px solid rgba(16,185,129,0.15)', color: '#6ee7b7' }}
        >
          <strong>🛡️ True Ghost Display:</strong> This overlay uses OS-level hardware display affinity (Windows: <code className="text-[10px]">SetWindowDisplayAffinity</code>, macOS: <code className="text-[10px]">WDA_EXCLUDEFROMCAPTURE</code>). It is completely invisible to <strong>all</strong> screen capture software: Zoom, Google Meet, Microsoft Teams, OBS, Discord, and any recording tool.
        </div>

        {/* Save */}
        <div className="flex justify-end gap-2 pt-1">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-xs rounded-lg transition-colors"
            style={{ color: 'rgba(255,255,255,0.4)' }}
          >
            Cancel
          </button>
          <button
            onClick={onSave}
            className="px-4 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all"
            style={{ background: '#2563eb', color: 'white' }}
          >
            {saveSuccess ? <Check className="w-3.5 h-3.5" /> : null}
            <span>{saveSuccess ? 'Saved!' : 'Save Settings'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
