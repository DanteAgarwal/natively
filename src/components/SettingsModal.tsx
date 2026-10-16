import React, { useState, useEffect } from 'react';
import {
  Settings,
  X,
  ExternalLink,
  Loader2,
  Check,
  Briefcase,
  ChevronRight,
  Headphones,
  Shield,
  Zap,
  Activity,
  RefreshCw,
  AlertTriangle,
  Cpu,
  Sliders,
  Server,
  Sparkles,
  Search,
  RotateCcw,
  CheckCircle2,
  XCircle,
  Eye,
  Lock,
} from 'lucide-react';
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
  testStatus: { testing: boolean; success?: boolean; error?: string } | null;
  onTestKey: (provider?: 'gemini' | 'groq' | 'openrouter' | 'router') => Promise<void>;
}

type SettingsTab = 'providers' | 'health' | 'routing' | 'circuits' | 'persona' | 'audio';

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
  const [activeTab, setActiveTab] = useState<SettingsTab>('providers');

  // Model Registry & Live Telemetry State
  const [registryModels, setRegistryModels] = useState<any[]>([]);
  const [healthTelemetry, setHealthTelemetry] = useState<any[]>([]);
  const [circuits, setCircuits] = useState<any[]>([]);
  const [quotas, setQuotas] = useState<any[]>([]);
  const [modelPrefs, setModelPrefs] = useState<any>({
    billingMode: 'FREE_ONLY',
    privacyMode: 'CLOUD_PERMITTED',
    pinnedModelIds: [],
    excludedModelIds: [],
    customEndpoints: [],
  });

  // Action states
  const [probingAll, setProbingAll] = useState(false);
  const [probingModelId, setProbingModelId] = useState<string | null>(null);
  const [refreshingCatalog, setRefreshingCatalog] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');
  const [providerFilter, setProviderFilter] = useState<string>('all');
  const [resettingCircuits, setResettingCircuits] = useState(false);

  // Load telemetry and registry whenever modal opens
  const refreshRegistryData = async () => {
    try {
      if (window.ghostAPI?.getModels) {
        const m = await window.ghostAPI.getModels();
        if (m) setRegistryModels(m);
      }
      if (window.ghostAPI?.getHealthTelemetry) {
        const t = await window.ghostAPI.getHealthTelemetry();
        if (t) setHealthTelemetry(t);
      }
      if (window.ghostAPI?.getCircuits) {
        const c = await window.ghostAPI.getCircuits();
        if (c) setCircuits(c);
      }
      if (window.ghostAPI?.getQuotas) {
        const q = await window.ghostAPI.getQuotas();
        if (q) setQuotas(q);
      }
      if (window.ghostAPI?.getModelPreferences) {
        const prefs = await window.ghostAPI.getModelPreferences();
        if (prefs) setModelPrefs(prefs);
      }
    } catch (err) {
      console.warn('Failed to load live registry state:', err);
    }
  };

  useEffect(() => {
    if (isOpen) {
      refreshRegistryData();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Health probe single model
  const handleProbeSingle = async (providerId: string, modelId: string) => {
    setProbingModelId(`${providerId}:${modelId}`);
    try {
      if (window.ghostAPI?.testModel) {
        await window.ghostAPI.testModel(providerId, modelId);
        await refreshRegistryData();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setProbingModelId(null);
    }
  };

  // Run all health probes
  const handleProbeAll = async () => {
    setProbingAll(true);
    try {
      if (window.ghostAPI?.runHealthProbes) {
        await window.ghostAPI.runHealthProbes();
        await refreshRegistryData();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setProbingAll(false);
    }
  };

  // Catalog sync
  const handleSyncCatalogs = async () => {
    setRefreshingCatalog(true);
    try {
      if (window.ghostAPI?.refreshCatalogs) {
        await window.ghostAPI.refreshCatalogs();
        await refreshRegistryData();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setRefreshingCatalog(false);
    }
  };

  // Reset circuit breakers
  const handleResetCircuits = async () => {
    setResettingCircuits(true);
    try {
      if (window.ghostAPI?.resetCircuits) {
        await window.ghostAPI.resetCircuits();
        await refreshRegistryData();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setResettingCircuits(false);
    }
  };

  // Policy toggles
  const handleToggleBillingMode = async () => {
    const nextMode = modelPrefs.billingMode === 'FREE_ONLY' ? 'ALLOW_PAID' : 'FREE_ONLY';
    const updated = { ...modelPrefs, billingMode: nextMode };
    setModelPrefs(updated);
    if (window.ghostAPI?.updateModelPreferences) {
      await window.ghostAPI.updateModelPreferences({ billingMode: nextMode });
    }
  };

  const handleTogglePrivacyMode = async () => {
    const nextMode = modelPrefs.privacyMode === 'LOCAL_ONLY' ? 'CLOUD_PERMITTED' : 'LOCAL_ONLY';
    const updated = { ...modelPrefs, privacyMode: nextMode };
    setModelPrefs(updated);
    if (window.ghostAPI?.updateModelPreferences) {
      await window.ghostAPI.updateModelPreferences({ privacyMode: nextMode });
    }
  };

  // Filtered models
  const filteredModels = registryModels.filter((m) => {
    const matchesProvider = providerFilter === 'all' || m.providerId === providerFilter;
    const matchesSearch =
      !searchFilter.trim() ||
      m.modelId.toLowerCase().includes(searchFilter.toLowerCase()) ||
      m.displayName.toLowerCase().includes(searchFilter.toLowerCase());
    return matchesProvider && matchesSearch;
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5"
      style={{ background: 'rgba(0,0,0,0.82)', backdropFilter: 'blur(12px)' }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="w-full max-w-4xl rounded-2xl flex flex-col overflow-hidden shadow-2xl transition-all"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'rgba(13, 14, 20, 0.98)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          boxShadow: '0 32px 90px rgba(0, 0, 0, 0.95), 0 0 40px rgba(59, 130, 246, 0.08)',
          height: '88vh',
          maxHeight: '740px',
        }}
      >
        {/* ── Modal Header ── */}
        <div
          className="flex items-center justify-between px-6 py-4 border-b shrink-0"
          style={{ borderColor: 'rgba(255, 255, 255, 0.07)', background: 'rgba(255, 255, 255, 0.02)' }}
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-blue-500/15 border border-blue-500/30 text-blue-400">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-white tracking-wide">Ghost Copilot Settings</h3>
                <span className="text-[10px] px-2 py-0.5 rounded-full font-mono bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
                  v1.1.6 Resilience
                </span>
                {modelPrefs.billingMode === 'FREE_ONLY' && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-mono bg-blue-500/15 border border-blue-500/30 text-blue-400">
                    $0 Free Guardrail Active
                  </span>
                )}
              </div>
              <p className="text-xs text-white/50">Manage model providers, health check probes, resilience policies and audio</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-white/40 hover:text-white hover:bg-white/5 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ── Main Layout: Tabs + Content ── */}
        <div className="flex flex-1 min-h-0 overflow-hidden">
          {/* Navigation Sidebar */}
          <div
            className="w-48 sm:w-56 p-3 flex flex-col gap-1 border-r shrink-0 overflow-y-auto"
            style={{ borderColor: 'rgba(255, 255, 255, 0.07)', background: 'rgba(255, 255, 255, 0.01)' }}
          >
            <button
              onClick={() => setActiveTab('providers')}
              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-medium transition-all text-left ${
                activeTab === 'providers'
                  ? 'bg-blue-600 text-white font-semibold shadow-md'
                  : 'text-white/60 hover:text-white hover:bg-white/5'
              }`}
            >
              <Cpu className="w-4 h-4 shrink-0" />
              <span>AI Providers & Keys</span>
            </button>

            <button
              onClick={() => setActiveTab('health')}
              className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium transition-all text-left ${
                activeTab === 'health'
                  ? 'bg-blue-600 text-white font-semibold shadow-md'
                  : 'text-white/60 hover:text-white hover:bg-white/5'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Activity className="w-4 h-4 shrink-0" />
                <span>Health Probes</span>
              </div>
              <span className="text-[10px] px-1.5 py-0.2 rounded font-mono bg-emerald-500/20 text-emerald-300">
                Live
              </span>
            </button>

            <button
              onClick={() => setActiveTab('routing')}
              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-medium transition-all text-left ${
                activeTab === 'routing'
                  ? 'bg-blue-600 text-white font-semibold shadow-md'
                  : 'text-white/60 hover:text-white hover:bg-white/5'
              }`}
            >
              <Shield className="w-4 h-4 shrink-0" />
              <span>Routing & Policies</span>
            </button>

            <button
              onClick={() => setActiveTab('circuits')}
              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-medium transition-all text-left ${
                activeTab === 'circuits'
                  ? 'bg-blue-600 text-white font-semibold shadow-md'
                  : 'text-white/60 hover:text-white hover:bg-white/5'
              }`}
            >
              <Zap className="w-4 h-4 shrink-0" />
              <span>Quotas & Circuits</span>
            </button>

            <button
              onClick={() => setActiveTab('persona')}
              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-medium transition-all text-left ${
                activeTab === 'persona'
                  ? 'bg-blue-600 text-white font-semibold shadow-md'
                  : 'text-white/60 hover:text-white hover:bg-white/5'
              }`}
            >
              <Briefcase className="w-4 h-4 shrink-0" />
              <span>Interview Persona</span>
            </button>

            <button
              onClick={() => setActiveTab('audio')}
              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-medium transition-all text-left ${
                activeTab === 'audio'
                  ? 'bg-blue-600 text-white font-semibold shadow-md'
                  : 'text-white/60 hover:text-white hover:bg-white/5'
              }`}
            >
              <Headphones className="w-4 h-4 shrink-0" />
              <span>Audio & Ghost Mode</span>
            </button>

            <div className="mt-auto pt-3 border-t border-white/5 space-y-2">
              <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-[11px] text-emerald-300">
                <div className="flex items-center gap-1.5 font-semibold text-emerald-400 mb-0.5">
                  <Shield className="w-3.5 h-3.5" />
                  <span>Stealth Active</span>
                </div>
                Window excluded from Zoom, Meet, OBS capture.
              </div>
            </div>
          </div>

          {/* Content Panel */}
          <div className="flex-1 p-6 overflow-y-auto space-y-6">
            {/* ─── TAB 1: AI Providers & Keys ─── */}
            {activeTab === 'providers' && (
              <div className="space-y-6">
                <div>
                  <h4 className="text-sm font-semibold text-white">Cloud Provider & Endpoints</h4>
                  <p className="text-xs text-white/50">
                    Select your active inference provider or configure zero-cost public routers.
                  </p>
                </div>

                {/* Provider Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <button
                    type="button"
                    onClick={() => setConfig({ ...config, provider: 'gemini' })}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      config.provider === 'gemini'
                        ? 'bg-blue-600/20 border-blue-500 text-white'
                        : 'bg-white/5 border-white/10 text-white/60 hover:text-white'
                    }`}
                  >
                    <div className="font-semibold text-xs">Google Gemini</div>
                    <div className="text-[10px] text-white/40 mt-0.5">Flash 3.8 / 3.5 Lite (Free)</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setConfig({ ...config, provider: 'groq' })}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      config.provider === 'groq'
                        ? 'bg-orange-600/20 border-orange-500 text-white'
                        : 'bg-white/5 border-white/10 text-white/60 hover:text-white'
                    }`}
                  >
                    <div className="font-semibold text-xs flex items-center justify-between">
                      <span>Groq Cloud</span>
                      <span className="text-[10px] text-orange-400">⚡ LPU</span>
                    </div>
                    <div className="text-[10px] text-white/40 mt-0.5">GPT OSS 120B / Llama 3.3</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setConfig({ ...config, provider: 'openrouter' })}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      config.provider === 'openrouter'
                        ? 'bg-purple-600/20 border-purple-500 text-white'
                        : 'bg-white/5 border-white/10 text-white/60 hover:text-white'
                    }`}
                  >
                    <div className="font-semibold text-xs flex items-center justify-between">
                      <span>OpenRouter</span>
                      <span className="text-[10px] text-purple-400">🌐 Free</span>
                    </div>
                    <div className="text-[10px] text-white/40 mt-0.5">Gemma 4 Vision / Nemotron</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setConfig({ ...config, provider: 'router' })}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      config.provider === 'router'
                        ? 'bg-emerald-600/20 border-emerald-500 text-white'
                        : 'bg-white/5 border-white/10 text-white/60 hover:text-white'
                    }`}
                  >
                    <div className="font-semibold text-xs flex items-center justify-between">
                      <span>Free Routers</span>
                      <span className="text-[10px] text-emerald-400">🔀 $0</span>
                    </div>
                    <div className="text-[10px] text-white/40 mt-0.5">Pollinations / Cerebras / Ollama</div>
                  </button>
                </div>

                {/* Gemini Form */}
                {config.provider === 'gemini' && (
                  <div className="p-4 rounded-xl bg-white/[0.02] border border-white/10 space-y-4">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-white">Google Gemini API Key</label>
                      <a
                        href="https://aistudio.google.com/app/apikey"
                        target="_blank"
                        rel="noreferrer"
                        className="text-[11px] text-blue-400 hover:underline flex items-center gap-1"
                      >
                        Get free Google Studio key <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                    <input
                      type="password"
                      value={config.geminiApiKey}
                      onChange={(e) => setConfig({ ...config, geminiApiKey: e.target.value })}
                      placeholder="AIzaSy..."
                      className="w-full px-3 py-2 text-xs rounded-lg font-mono bg-white/5 border border-white/10 text-white outline-none focus:border-blue-500"
                    />

                    <div className="flex items-center justify-between">
                      <button
                        onClick={() => onTestKey('gemini')}
                        disabled={testStatus?.testing || !config.geminiApiKey.trim()}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white/10 hover:bg-white/15 text-white disabled:opacity-40 transition-all flex items-center gap-1.5"
                      >
                        {testStatus?.testing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                        <span>Test Gemini API Key</span>
                      </button>
                      {testStatus?.success === true && (
                        <span className="text-xs text-emerald-400 flex items-center gap-1">
                          <Check className="w-3.5 h-3.5" /> Valid Key
                        </span>
                      )}
                      {testStatus?.success === false && (
                        <span className="text-xs text-red-400 truncate max-w-xs">{testStatus.error}</span>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-white/70">Selected Active Model</label>
                      <select
                        value={config.model}
                        onChange={(e) => setConfig({ ...config, model: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl text-xs bg-zinc-900 border border-white/10 text-white outline-none"
                      >
                        <option value="gemini-3.8-flash">gemini-3.8-flash — Flagship Intelligence & Vision (Free)</option>
                        <option value="gemini-3.5-flash-lite">gemini-3.5-flash-lite — Ultra-Fast & Lightweight (Free)</option>
                        <option value="gemini-3.7-flash">gemini-3.7-flash — Fast Coding & Agents (Free)</option>
                        <option value="gemini-3.6-flash">gemini-3.6-flash — Balanced Multimodal (Free)</option>
                      </select>
                    </div>
                  </div>
                )}

                {/* Groq Form */}
                {config.provider === 'groq' && (
                  <div className="p-4 rounded-xl bg-white/[0.02] border border-white/10 space-y-4">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-white">Groq API Key</label>
                      <a
                        href="https://console.groq.com/keys"
                        target="_blank"
                        rel="noreferrer"
                        className="text-[11px] text-orange-400 hover:underline flex items-center gap-1"
                      >
                        Get free Groq key <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                    <input
                      type="password"
                      value={config.groqApiKey}
                      onChange={(e) => setConfig({ ...config, groqApiKey: e.target.value })}
                      placeholder="gsk_..."
                      className="w-full px-3 py-2 text-xs rounded-lg font-mono bg-white/5 border border-white/10 text-white outline-none focus:border-orange-500"
                    />

                    <div className="flex items-center justify-between">
                      <button
                        onClick={() => onTestKey('groq')}
                        disabled={testStatus?.testing || !config.groqApiKey.trim()}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white/10 hover:bg-white/15 text-white disabled:opacity-40 transition-all flex items-center gap-1.5"
                      >
                        {testStatus?.testing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                        <span>Test Groq API Key</span>
                      </button>
                      {testStatus?.success === true && (
                        <span className="text-xs text-emerald-400 flex items-center gap-1">
                          <Check className="w-3.5 h-3.5" /> Valid Key
                        </span>
                      )}
                      {testStatus?.success === false && (
                        <span className="text-xs text-red-400 truncate max-w-xs">{testStatus.error}</span>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-white/70">Selected Active Model</label>
                      <select
                        value={config.groqModel}
                        onChange={(e) => setConfig({ ...config, groqModel: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl text-xs bg-zinc-900 border border-white/10 text-white outline-none"
                      >
                        <option value="llama-3.3-70b-versatile">llama-3.3-70b-versatile — Flagship Reasoning & Code (280 tok/s) ⚡</option>
                        <option value="llama-3.1-8b-instant">llama-3.1-8b-instant — Ultra-Fast (~560 tok/s, 20k TPM) 🚀</option>
                        <option value="openai/gpt-oss-120b">openai/gpt-oss-120b — Flagship 120B Reasoning & Architecture 🧠</option>
                        <option value="openai/gpt-oss-20b">openai/gpt-oss-20b — Ultra-Fast 20B Reasoning ⚡</option>
                      </select>
                    </div>
                  </div>
                )}

                {/* OpenRouter Form */}
                {config.provider === 'openrouter' && (
                  <div className="p-4 rounded-xl bg-white/[0.02] border border-white/10 space-y-4">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-white">OpenRouter API Key</label>
                      <a
                        href="https://openrouter.ai/keys"
                        target="_blank"
                        rel="noreferrer"
                        className="text-[11px] text-purple-400 hover:underline flex items-center gap-1"
                      >
                        Get free OpenRouter key <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                    <input
                      type="password"
                      value={config.openrouterApiKey}
                      onChange={(e) => setConfig({ ...config, openrouterApiKey: e.target.value })}
                      placeholder="sk-or-v1-..."
                      className="w-full px-3 py-2 text-xs rounded-lg font-mono bg-white/5 border border-white/10 text-white outline-none focus:border-purple-500"
                    />

                    <div className="flex items-center justify-between">
                      <button
                        onClick={() => onTestKey('openrouter')}
                        disabled={testStatus?.testing || !config.openrouterApiKey.trim()}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white/10 hover:bg-white/15 text-white disabled:opacity-40 transition-all flex items-center gap-1.5"
                      >
                        {testStatus?.testing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                        <span>Test OpenRouter Key</span>
                      </button>
                      {testStatus?.success === true && (
                        <span className="text-xs text-emerald-400 flex items-center gap-1">
                          <Check className="w-3.5 h-3.5" /> Valid Key
                        </span>
                      )}
                      {testStatus?.success === false && (
                        <span className="text-xs text-red-400 truncate max-w-xs">{testStatus.error}</span>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-white/70">Selected Active Free Model</label>
                      <select
                        value={config.openrouterModel || 'openrouter/free'}
                        onChange={(e) => setConfig({ ...config, openrouterModel: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl text-xs bg-zinc-900 border border-white/10 text-white outline-none"
                      >
                        <option value="openrouter/free">openrouter/free — Smart Free Auto-Router 🔀</option>
                        <option value="google/gemma-4-31b-it:free">google/gemma-4-31b-it:free — Multimodal Vision & Reasoning 👁️⚡</option>
                        <option value="google/gemma-4-26b-a4b-it:free">google/gemma-4-26b-a4b-it:free — Fast Vision (262k) 👁️🚀</option>
                        <option value="nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free">nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free 👁️🧠</option>
                        <option value="nvidia/nemotron-3.5-lightning:free">nvidia/nemotron-3.5-lightning:free — 1M Context Engine ⚡</option>
                      </select>
                    </div>
                  </div>
                )}

                {/* Free Router Form */}
                {config.provider === 'router' && (
                  <div className="p-4 rounded-xl bg-white/[0.02] border border-white/10 space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-white">Preset Router Gateway</label>
                      <select
                        value={config.routerPreset}
                        onChange={(e) => {
                          const p = e.target.value;
                          let baseUrl = config.routerBaseUrl;
                          let defaultModel = config.routerModel;
                          if (p === 'pollinations') {
                            baseUrl = 'https://text.pollinations.ai/openai';
                            defaultModel = 'openai';
                          } else if (p === 'cerebras') {
                            baseUrl = 'https://api.cerebras.ai/v1';
                            defaultModel = 'llama-3.3-70b';
                          } else if (p === 'ollama') {
                            baseUrl = 'http://localhost:11434/v1';
                            defaultModel = 'llama3.2';
                          }
                          setConfig({ ...config, routerPreset: p, routerBaseUrl: baseUrl, routerModel: defaultModel });
                        }}
                        className="w-full px-3 py-2 rounded-xl text-xs bg-zinc-900 border border-white/10 text-white outline-none"
                      >
                        <option value="pollinations">Pollinations AI — 100% Free (Zero Setup, No Key Needed) 🎁</option>
                        <option value="cerebras">Cerebras Cloud — Ultra-Fast 2,000 tok/s Free Tier ⚡</option>
                        <option value="ollama">Ollama — 100% Local Offline Privacy 💻</option>
                        <option value="custom">Custom OpenAI-Compatible Router (vLLM / LiteLLM / Bifrost) 🔀</option>
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-white/70">Endpoint Base URL</label>
                        <input
                          type="text"
                          value={config.routerBaseUrl}
                          onChange={(e) => setConfig({ ...config, routerBaseUrl: e.target.value })}
                          className="w-full px-3 py-2 text-xs rounded-lg font-mono bg-white/5 border border-white/10 text-white outline-none"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-white/70">Target Model Name</label>
                        <input
                          type="text"
                          value={config.routerModel}
                          onChange={(e) => setConfig({ ...config, routerModel: e.target.value })}
                          className="w-full px-3 py-2 text-xs rounded-lg font-mono bg-white/5 border border-white/10 text-white outline-none"
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-medium text-white/70">
                        API Key <span className="text-white/40 text-[10px]">(Optional for Pollinations / Ollama)</span>
                      </label>
                      <input
                        type="password"
                        value={config.routerApiKey}
                        onChange={(e) => setConfig({ ...config, routerApiKey: e.target.value })}
                        placeholder="Key or token if required..."
                        className="w-full px-3 py-2 text-xs rounded-lg font-mono bg-white/5 border border-white/10 text-white outline-none"
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <button
                        onClick={() => onTestKey('router')}
                        disabled={testStatus?.testing}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white/10 hover:bg-white/15 text-white disabled:opacity-40 transition-all flex items-center gap-1.5"
                      >
                        {testStatus?.testing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                        <span>Test Connection</span>
                      </button>
                      {testStatus?.success === true && (
                        <span className="text-xs text-emerald-400 flex items-center gap-1">
                          <Check className="w-3.5 h-3.5" /> Connected Successfully
                        </span>
                      )}
                      {testStatus?.success === false && (
                        <span className="text-xs text-red-400 truncate max-w-xs">{testStatus.error}</span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ─── TAB 2: Model Registry & Live Health Checks ─── */}
            {activeTab === 'health' && (
              <div className="space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h4 className="text-sm font-semibold text-white flex items-center gap-2">
                      <Activity className="w-4 h-4 text-emerald-400" />
                      Live Model Health Probes & Registry
                    </h4>
                    <p className="text-xs text-white/50">
                      Real-time capability testing, latency benchmarks, and deprecation telemetry.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleSyncCatalogs}
                      disabled={refreshingCatalog}
                      className="px-2.5 py-1.5 rounded-lg text-xs bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 flex items-center gap-1.5 transition-all"
                      title="Sync live upstream model catalog"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${refreshingCatalog ? 'animate-spin' : ''}`} />
                      <span>Sync Catalogs</span>
                    </button>
                    <button
                      onClick={handleProbeAll}
                      disabled={probingAll}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-1.5 shadow transition-all"
                    >
                      {probingAll ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Activity className="w-3.5 h-3.5" />}
                      <span>{probingAll ? 'Probing Models...' : 'Run All Health Probes'}</span>
                    </button>
                  </div>
                </div>

                {/* Filter and Search Bar */}
                <div className="flex flex-col sm:flex-row gap-2">
                  <div className="relative flex-1">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-white/40" />
                    <input
                      type="text"
                      value={searchFilter}
                      onChange={(e) => setSearchFilter(e.target.value)}
                      placeholder="Search model ID or name..."
                      className="w-full pl-8 pr-3 py-2 text-xs rounded-xl bg-white/5 border border-white/10 text-white outline-none focus:border-blue-500"
                    />
                  </div>
                  <div className="flex gap-1 overflow-x-auto pb-1 sm:pb-0">
                    {['all', 'gemini', 'groq', 'openrouter', 'ollama', 'router'].map((p) => (
                      <button
                        key={p}
                        onClick={() => setProviderFilter(p)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all ${
                          providerFilter === p
                            ? 'bg-blue-600 text-white font-semibold'
                            : 'bg-white/5 text-white/50 hover:text-white'
                        }`}
                      >
                        {p.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Model Registry Cards List */}
                <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
                  {filteredModels.length === 0 ? (
                    <div className="p-8 text-center text-xs text-white/40">No models match your filter.</div>
                  ) : (
                    filteredModels.map((model) => {
                      const telemetry = healthTelemetry.find(
                        (t) => t.providerId === model.providerId && t.modelId === model.modelId
                      );
                      const isProbing = probingModelId === `${model.providerId}:${model.modelId}`;
                      const isHealthy = (telemetry?.health || model.health) === 'healthy';
                      const isDegraded = (telemetry?.health || model.health) === 'degraded';
                      const isDown = (telemetry?.health || model.health) === 'down';

                      return (
                        <div
                          key={`${model.providerId}:${model.modelId}`}
                          className="p-3 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white/[0.02] border-white/10 hover:border-white/20"
                        >
                          <div className="space-y-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold text-xs text-white truncate">{model.displayName}</span>
                              <span className="text-[10px] font-mono text-white/40">{model.modelId}</span>
                              <span
                                className={`text-[9px] px-1.5 py-0.2 rounded font-bold uppercase tracking-wider ${
                                  model.costClass === 'FREE'
                                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                    : model.costClass === 'PROMO_CREDIT'
                                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                    : 'bg-red-500/20 text-red-300 border border-red-500/30'
                                }`}
                              >
                                {model.costClass}
                              </span>
                              {model.deprecationNote && (
                                <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                  Deprecated
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-2 text-[10px] text-white/40">
                              <span>Provider: <strong className="text-white/70">{model.providerId}</strong></span>
                              <span>•</span>
                              <span>Context: <strong className="text-white/70">{Math.round(model.contextWindow / 1024)}k</strong></span>
                              <span>•</span>
                              <div className="flex gap-1">
                                {model.supportedInputModalities?.includes('image') && (
                                  <span className="text-cyan-400">Vision 👁️</span>
                                )}
                                {model.capabilities?.includes('json_mode') && (
                                  <span className="text-indigo-400">JSON</span>
                                )}
                                {model.capabilities?.includes('thinking') && (
                                  <span className="text-amber-400">Reasoning</span>
                                )}
                              </div>
                            </div>

                            {telemetry?.lastFailureReason && (
                              <div className="text-[10px] text-red-400 truncate max-w-md">
                                Warning: {telemetry.lastFailureReason}
                              </div>
                            )}
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {/* Health Pill */}
                            <div
                              className={`px-2.5 py-1 rounded-full text-[11px] font-medium flex items-center gap-1.5 border ${
                                isHealthy
                                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                                  : isDegraded
                                  ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                                  : isDown
                                  ? 'bg-red-500/10 border-red-500/30 text-red-400'
                                  : 'bg-white/5 border-white/10 text-white/40'
                              }`}
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${
                                  isHealthy ? 'bg-emerald-400' : isDegraded ? 'bg-amber-400' : isDown ? 'bg-red-400' : 'bg-white/40'
                                }`}
                              />
                              <span>
                                {isHealthy
                                  ? `Healthy (${telemetry?.measuredLatencyMs || 180}ms)`
                                  : isDegraded
                                  ? 'Degraded (Spike)'
                                  : isDown
                                  ? 'Offline'
                                  : 'Untested'}
                              </span>
                            </div>

                            {/* Probe Button */}
                            <button
                              onClick={() => handleProbeSingle(model.providerId, model.modelId)}
                              disabled={isProbing}
                              className="px-2.5 py-1 rounded-lg text-xs font-medium bg-white/5 hover:bg-white/15 text-white/80 border border-white/10 transition-all flex items-center gap-1 disabled:opacity-40"
                              title="Send non-sensitive health check probe"
                            >
                              {isProbing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3 text-amber-400" />}
                              <span>Probe</span>
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            {/* ─── TAB 3: Routing & Policies ─── */}
            {activeTab === 'routing' && (
              <div className="space-y-6">
                <div>
                  <h4 className="text-sm font-semibold text-white flex items-center gap-2">
                    <Shield className="w-4 h-4 text-blue-400" />
                    Routing Policy & Resilience Rules
                  </h4>
                  <p className="text-xs text-white/50">
                    Control cost safety guardrails, local privacy gating, and automatic provider failover limits.
                  </p>
                </div>

                {/* FREE_ONLY Guardrail */}
                <div className="p-4 rounded-xl border border-white/10 bg-white/[0.02] space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs font-semibold text-white flex items-center gap-1.5">
                        <Lock className="w-3.5 h-3.5 text-blue-400" />
                        Strict $0 Free-Only Guardrail (FREE_ONLY)
                      </div>
                      <p className="text-[11px] text-white/50 leading-relaxed mt-0.5">
                        Guarantees $0 operation by blocking any model marked PAID, PROMO_CREDIT, or UNKNOWN before dispatch.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleToggleBillingMode}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        modelPrefs.billingMode === 'FREE_ONLY' ? 'bg-blue-600' : 'bg-zinc-700'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          modelPrefs.billingMode === 'FREE_ONLY' ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                  <div className="text-[10px] text-blue-300/80 bg-blue-500/10 p-2 rounded-lg">
                    Status: <strong>{modelPrefs.billingMode}</strong> — PRD §10 SEC-03 Compliant.
                  </div>
                </div>

                {/* LOCAL_ONLY Privacy Mode */}
                <div className="p-4 rounded-xl border border-white/10 bg-white/[0.02] space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs font-semibold text-white flex items-center gap-1.5">
                        <Eye className="w-3.5 h-3.5 text-emerald-400" />
                        Local-Only Offline Privacy Mode (LOCAL_ONLY)
                      </div>
                      <p className="text-[11px] text-white/50 leading-relaxed mt-0.5">
                        Completely disables all cloud APIs (Gemini, Groq, OpenRouter). Dispatches 100% through local Ollama.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleTogglePrivacyMode}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        modelPrefs.privacyMode === 'LOCAL_ONLY' ? 'bg-emerald-600' : 'bg-zinc-700'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          modelPrefs.privacyMode === 'LOCAL_ONLY' ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                  <div className="text-[10px] text-emerald-300/80 bg-emerald-500/10 p-2 rounded-lg">
                    Status: <strong>{modelPrefs.privacyMode}</strong> — Zero data leaves your computer when enabled.
                  </div>
                </div>

                {/* Auto Fallback Toggle */}
                <div className="p-4 rounded-xl border border-white/10 bg-white/[0.02] space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs font-semibold text-white">Cross-Provider Intelligent Failover</div>
                      <p className="text-[11px] text-white/50 leading-relaxed mt-0.5">
                        When a provider encounters HTTP 503, rate limits, or timeouts, seamlessly route to an independent provider.
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={config.autoFallback}
                      onChange={(e) => setConfig({ ...config, autoFallback: e.target.checked })}
                      className="w-4 h-4 rounded accent-blue-600 cursor-pointer"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* ─── TAB 4: Quotas & Circuit Breakers ─── */}
            {activeTab === 'circuits' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-semibold text-white flex items-center gap-2">
                      <Zap className="w-4 h-4 text-amber-400" />
                      Circuit Breakers & Quota Headroom
                    </h4>
                    <p className="text-xs text-white/50">
                      Monitor live provider trip status, failure backoffs, and sliding-window rate limit headroom.
                    </p>
                  </div>
                  <button
                    onClick={handleResetCircuits}
                    disabled={resettingCircuits}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white/10 hover:bg-white/15 text-white flex items-center gap-1.5 transition-all"
                  >
                    <RotateCcw className={`w-3.5 h-3.5 ${resettingCircuits ? 'animate-spin' : ''}`} />
                    <span>Reset All Circuit Breakers</span>
                  </button>
                </div>

                {/* Circuit Breakers Grid */}
                <div className="space-y-3">
                  <div className="text-xs font-semibold text-white/80">Active Circuit Breakers</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {circuits.length === 0 ? (
                      <div className="col-span-2 p-6 rounded-xl bg-white/[0.02] border border-white/10 text-center text-xs text-white/40">
                        All circuits are in pristine CLOSED (healthy) condition.
                      </div>
                    ) : (
                      circuits.map((cb) => (
                        <div
                          key={cb.key}
                          className="p-3.5 rounded-xl border bg-white/[0.02] border-white/10 space-y-2"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-mono text-xs font-semibold text-white">{cb.key}</span>
                            <span
                              className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                                cb.state === 'CLOSED'
                                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                  : cb.state === 'HALF_OPEN'
                                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                                  : 'bg-red-500/20 text-red-400 border border-red-500/30'
                              }`}
                            >
                              {cb.state}
                            </span>
                          </div>
                          <div className="text-[11px] text-white/50 space-y-0.5">
                            <div>Consecutive Failures: <strong className="text-white">{cb.consecutiveFailures}</strong></div>
                            <div>Open Count: <strong className="text-white">{cb.openCount}</strong></div>
                            <div>Cooldown: <strong className="text-white">{Math.round(cb.currentCooldownMs / 1000)}s</strong></div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Quotas Headroom */}
                <div className="space-y-3">
                  <div className="text-xs font-semibold text-white/80">Sliding Window Headroom (RPM / TPM)</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {quotas.length === 0 ? (
                      <div className="col-span-2 p-6 rounded-xl bg-white/[0.02] border border-white/10 text-center text-xs text-white/40">
                        No active quota exhaustion recorded. All limits have 100% headroom.
                      </div>
                    ) : (
                      quotas.map((q) => (
                        <div
                          key={`${q.providerId}:${q.modelId}`}
                          className="p-3.5 rounded-xl border bg-white/[0.02] border-white/10 space-y-2"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-mono text-xs font-semibold text-white">{q.providerId} / {q.modelId}</span>
                            <span className="text-[10px] text-emerald-400">Headroom OK</span>
                          </div>
                          <div className="space-y-1">
                            <div className="flex justify-between text-[10px] text-white/50">
                              <span>RPM Used</span>
                              <span>{q.rpmUsed} / {q.limits?.rpm || 15}</span>
                            </div>
                            <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-blue-500 rounded-full"
                                style={{ width: `${Math.min(100, ((q.rpmUsed || 0) / (q.limits?.rpm || 15)) * 100)}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ─── TAB 5: Interview Persona & System Prompt ─── */}
            {activeTab === 'persona' && (
              <div className="space-y-6">
                <div>
                  <h4 className="text-sm font-semibold text-white flex items-center gap-2">
                    <Briefcase className="w-4 h-4 text-emerald-400" />
                    Resume, JD & Interview Persona
                  </h4>
                  <p className="text-xs text-white/50">
                    Align responses with your background, target role, and interviewer audience.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs font-semibold text-white">Full Resume & JD Context</div>
                      <div className="text-[11px] text-emerald-300/80">
                        Status:{' '}
                        {config.userProfileContext?.enabled ? (
                          <strong className="text-emerald-400">Active ({config.userProfileContext.audienceType})</strong>
                        ) : (
                          <strong className="text-white/50">Not configured</strong>
                        )}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onOpenContextModal();
                      }}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-1 shadow"
                    >
                      <span>Configure Persona</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <p className="text-[11px] text-white/60 leading-relaxed">
                    Provide your full resume, target job description (JD), and interviewer audience so the AI speaks directly in first-person as you, answering technical questions at the right depth using the STAR method.
                  </p>
                </div>

                {/* System Instruction */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-white">Custom System Instruction</label>
                  <textarea
                    rows={4}
                    value={config.systemInstruction}
                    onChange={(e) => setConfig({ ...config, systemInstruction: e.target.value })}
                    placeholder="e.g. You are a Staff Software Engineer. Structure solutions with Time & Space Complexity..."
                    className="w-full p-3 rounded-xl text-xs bg-white/5 border border-white/10 text-white outline-none focus:border-blue-500 resize-none font-mono"
                  />
                </div>

                {/* Temperature Slider */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-white">Temperature (Creativity vs Determinism)</label>
                    <span className="text-xs font-mono text-blue-400">{config.temperature ?? 0.7}</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={config.temperature ?? 0.7}
                    onChange={(e) => setConfig({ ...config, temperature: parseFloat(e.target.value) })}
                    className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-blue-500"
                  />
                  <div className="flex justify-between text-[10px] text-white/40">
                    <span>0.0 (Precise / Code)</span>
                    <span>0.7 (Balanced / Recommended)</span>
                    <span>1.0 (Creative)</span>
                  </div>
                </div>
              </div>
            )}

            {/* ─── TAB 6: Audio & Ghost Display ─── */}
            {activeTab === 'audio' && (
              <div className="space-y-6">
                <div>
                  <h4 className="text-sm font-semibold text-white flex items-center gap-2">
                    <Headphones className="w-4 h-4 text-cyan-400" />
                    Audio Loopback & Stealth Display
                  </h4>
                  <p className="text-xs text-white/50">
                    Configure meeting audio capture device and verify hardware display protection.
                  </p>
                </div>

                {/* Meeting Loopback Audio Device */}
                <div className="p-4 rounded-xl border border-white/10 bg-white/[0.02] space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-white">Meeting Audio Loopback Device</label>
                    <span className="text-[10px] font-mono text-cyan-400 px-2 py-0.5 rounded bg-cyan-500/10 border border-cyan-500/20">
                      Rust WASAPI Native
                    </span>
                  </div>
                  <p className="text-[11px] text-white/50 leading-relaxed">
                    Select the speaker or headphones where you hear other meeting participants to enable live real-time transcription:
                  </p>
                  <select
                    value={selectedOutputDevice}
                    onChange={(e) => setSelectedOutputDevice(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-zinc-900 border border-white/10 text-white outline-none cursor-pointer"
                  >
                    <option value="" className="bg-zinc-900 text-white">Default Audio Output (Auto-detect)</option>
                    {audioDevices.outputs.map((dev) => (
                      <option key={dev.id} value={dev.id} className="bg-zinc-900 text-white">
                        {dev.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Ghost Shield Technical Details */}
                <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400">
                    <Shield className="w-4 h-4" />
                    <span>Hardware Stealth Display Active</span>
                  </div>
                  <p className="text-[11px] text-white/70 leading-relaxed">
                    Ghost mode uses OS kernel-level hardware display exclusion:
                  </p>
                  <ul className="text-[11px] text-white/60 space-y-1 list-disc list-inside">
                    <li><strong className="text-white/80">Windows:</strong> <code className="text-[10px] font-mono text-emerald-300">SetWindowDisplayAffinity(WDA_EXCLUDEFROMCAPTURE)</code></li>
                    <li><strong className="text-white/80">macOS:</strong> <code className="text-[10px] font-mono text-emerald-300">NSWindow.sharingType = .none</code></li>
                    <li>Invisible to Zoom, Microsoft Teams, Google Meet, OBS Studio, Discord, and screen capture tools.</li>
                  </ul>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Modal Footer ── */}
        <div
          className="flex items-center justify-between px-6 py-3 border-t shrink-0"
          style={{ borderColor: 'rgba(255, 255, 255, 0.07)', background: 'rgba(255, 255, 255, 0.02)' }}
        >
          <div className="text-xs text-white/40">
            Press <kbd className="px-1.5 py-0.5 rounded bg-white/10 text-white/70 font-mono text-[10px]">Esc</kbd> to exit
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3.5 py-1.5 text-xs text-white/50 hover:text-white rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={onSave}
              className="px-5 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white flex items-center gap-1.5 shadow-lg shadow-blue-500/20 transition-all"
            >
              {saveSuccess ? <Check className="w-3.5 h-3.5" /> : null}
              <span>{saveSuccess ? 'Saved!' : 'Save Settings'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
