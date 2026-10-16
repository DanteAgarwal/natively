import React from 'react';
import {
  Sparkles,
  Camera,
  Headphones,
  Mic,
  Briefcase,
  Settings,
  Shield,
  Zap,
} from 'lucide-react';

interface EmptyStateProps {
  onCapture: () => void;
  onOpenSettings: () => void;
  onToggleMeetingAudio: () => void;
  onOpenContextModal: () => void;
  hasApiKey: boolean;
  provider: 'gemini' | 'groq' | 'openrouter' | 'router';
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  onCapture,
  onOpenSettings,
  onToggleMeetingAudio,
  onOpenContextModal,
  hasApiKey,
  provider,
}) => {
  return (
    <div className="h-full flex flex-col items-center justify-center text-center p-6 select-none animate-in fade-in duration-300">
      {/* Ambient Orb & Emblem */}
      <div className="relative mb-4">
        <div className="absolute -inset-4 bg-gradient-to-r from-blue-600/30 to-purple-600/30 rounded-full blur-xl opacity-75 animate-pulse" />
        <div className="relative w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500/20 via-zinc-900 to-indigo-500/20 border border-white/10 flex items-center justify-center shadow-2xl">
          <Sparkles className="w-7 h-7 text-blue-400" />
        </div>
      </div>

      {/* Headings */}
      <h2 className="text-sm font-semibold text-white tracking-wide">
        Natively Ghost Copilot
      </h2>
      <p className="text-xs text-white/50 max-w-[280px] mt-1 mb-6 leading-relaxed">
        100% invisible on screen shares. Live answers for coding screener tests, system design, and executive interviews.
      </p>

      {/* Quick Launch Cards */}
      {hasApiKey ? (
        <div className="grid grid-cols-2 gap-2.5 w-full max-w-sm">
          <button
            onClick={onCapture}
            className="flex items-center gap-2.5 p-3 rounded-2xl bg-white/[0.03] hover:bg-white/[0.08] border border-white/[0.08] hover:border-blue-500/40 text-left transition-all active:scale-[0.98] group"
          >
            <div className="w-8 h-8 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 shrink-0 group-hover:scale-105 transition-transform">
              <Camera className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-semibold text-white group-hover:text-blue-300 transition-colors">
                Screen Vision
              </div>
              <div className="text-[10px] font-mono text-white/40 mt-0.5">
                Ctrl+Shift+S
              </div>
            </div>
          </button>

          <button
            onClick={onToggleMeetingAudio}
            className="flex items-center gap-2.5 p-3 rounded-2xl bg-white/[0.03] hover:bg-white/[0.08] border border-white/[0.08] hover:border-cyan-500/40 text-left transition-all active:scale-[0.98] group"
          >
            <div className="w-8 h-8 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 shrink-0 group-hover:scale-105 transition-transform">
              <Headphones className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-semibold text-white group-hover:text-cyan-300 transition-colors">
                Meeting Audio
              </div>
              <div className="text-[10px] font-mono text-white/40 mt-0.5">
                Alt+M
              </div>
            </div>
          </button>

          <button
            onClick={onOpenContextModal}
            className="flex items-center gap-2.5 p-3 rounded-2xl bg-white/[0.03] hover:bg-white/[0.08] border border-white/[0.08] hover:border-emerald-500/40 text-left transition-all active:scale-[0.98] group"
          >
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0 group-hover:scale-105 transition-transform">
              <Briefcase className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-semibold text-white group-hover:text-emerald-300 transition-colors">
                Resume & JD
              </div>
              <div className="text-[10px] font-mono text-white/40 mt-0.5">
                Alt+U
              </div>
            </div>
          </button>

          <button
            onClick={onOpenSettings}
            className="flex items-center gap-2.5 p-3 rounded-2xl bg-white/[0.03] hover:bg-white/[0.08] border border-white/[0.08] hover:border-purple-500/40 text-left transition-all active:scale-[0.98] group"
          >
            <div className="w-8 h-8 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 shrink-0 group-hover:scale-105 transition-transform">
              <Settings className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-semibold text-white group-hover:text-purple-300 transition-colors">
                Settings
              </div>
              <div className="text-[10px] font-mono text-white/40 mt-0.5">
                Ctrl+,
              </div>
            </div>
          </button>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3">
          <button
            onClick={onOpenSettings}
            className="flex items-center gap-2 px-5 py-2.5 rounded-2xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-xl hover:shadow-blue-500/25 active:scale-95 transition-all"
          >
            <Zap className="w-4 h-4" />
            <span>Configure API Key</span>
          </button>
          <span className="text-[11px] text-white/40">
            Works with free Google Gemini, Groq, OpenRouter, or Pollinations
          </span>
        </div>
      )}
    </div>
  );
};

export default EmptyState;
