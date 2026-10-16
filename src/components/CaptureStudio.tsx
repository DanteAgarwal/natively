import React from 'react';
import {
  Camera,
  Shield,
  Loader2,
  Sparkles,
  Zap,
  ArrowRight,
  Code,
  Bug,
  HelpCircle,
  FileText,
} from 'lucide-react';
import { QUICK_PROMPTS } from '../types/config';

interface CaptureStudioProps {
  onCapture: (prompt?: string) => void;
  capturePrompt: string;
  setCapturePrompt: (val: string) => void;
  captureStatus: 'idle' | 'capturing' | 'analyzing';
  isStreaming: boolean;
  hasApiKey: boolean;
  isGhostActive: boolean;
  recentCaptures: Array<{ id: string; previewUrl: string; prompt?: string }>;
  onSelectCapture: (id: string) => void;
  onOpenSettings: () => void;
}

export const CaptureStudio: React.FC<CaptureStudioProps> = ({
  onCapture,
  capturePrompt,
  setCapturePrompt,
  captureStatus,
  isStreaming,
  hasApiKey,
  isGhostActive,
  recentCaptures,
  onSelectCapture,
  onOpenSettings,
}) => {
  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-y-auto p-4 space-y-4 select-none" style={{ scrollbarWidth: 'none' }}>
      {/* 1. Ghost Shield Stealth Guarantee Card */}
      <div className="relative overflow-hidden rounded-2xl p-4 bg-gradient-to-r from-emerald-950/20 via-zinc-900/40 to-emerald-950/20 border border-emerald-500/25 shadow-lg">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-white">Ghost Stealth Protection</span>
                <span className="text-[10px] px-2 py-0.2 rounded-full font-mono bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Locked ON
                </span>
              </div>
              <p className="text-[11px] text-white/50 mt-0.5">
                100% invisible during Zoom, Google Meet, MS Teams, and OBS screen sharing.
              </p>
            </div>
          </div>
          <button
            onClick={() => onCapture()}
            disabled={isStreaming || !hasApiKey || captureStatus !== 'idle'}
            className="shrink-0 flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-lg active:scale-95 disabled:opacity-40 transition-all"
          >
            {captureStatus === 'capturing' ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Capturing...</span>
              </>
            ) : captureStatus === 'analyzing' ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Analyzing...</span>
              </>
            ) : (
              <>
                <Camera className="w-3.5 h-3.5" />
                <span>Capture Screen</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* 2. Quick One-Click Intent Cards */}
      <div>
        <div className="flex items-center justify-between mb-2 px-0.5">
          <span className="text-xs font-semibold text-white/70">Instant Screen Solvers</span>
          <span className="text-[10px] font-mono text-white/30">Hotkey: Ctrl+Shift+S</span>
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          {QUICK_PROMPTS.map((qp) => (
            <button
              key={qp.label}
              onClick={() => onCapture(qp.prompt)}
              disabled={isStreaming || !hasApiKey || captureStatus !== 'idle'}
              className="flex items-start gap-3 p-3 rounded-2xl text-left bg-white/[0.03] hover:bg-white/[0.07] border border-white/[0.07] hover:border-blue-500/30 transition-all active:scale-[0.98] disabled:opacity-40 group"
            >
              <div className="w-8 h-8 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-sm shrink-0 group-hover:scale-105 transition-transform">
                {qp.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold text-white group-hover:text-blue-300 transition-colors flex items-center justify-between">
                  <span>{qp.label}</span>
                  <ArrowRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity text-blue-400" />
                </div>
                <p className="text-[10px] text-white/40 mt-0.5 line-clamp-2 leading-relaxed">
                  {qp.prompt}
                </p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* 3. Custom Prompt Capture Bar */}
      <div>
        <span className="text-xs font-semibold text-white/70 block mb-2 px-0.5">Custom Prompt & Vision Scan</span>
        <div className="flex items-center gap-2 p-1.5 rounded-2xl bg-white/[0.04] border border-white/[0.08] focus-within:border-blue-500/50 focus-within:ring-2 focus-within:ring-blue-500/20 transition-all">
          <input
            type="text"
            value={capturePrompt}
            onChange={(e) => setCapturePrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onCapture();
            }}
            placeholder="e.g. Find the bug in the code, or write optimal Big-O solution..."
            disabled={isStreaming || !hasApiKey}
            className="flex-1 bg-transparent px-2.5 text-xs text-white placeholder-white/35 outline-none"
          />
          <button
            onClick={() => onCapture()}
            disabled={isStreaming || !hasApiKey || captureStatus !== 'idle'}
            className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white transition-all active:scale-95 disabled:opacity-40 flex items-center gap-1.5"
          >
            <Camera className="w-3.5 h-3.5" />
            <span>Scan</span>
          </button>
        </div>
      </div>

      {/* 4. Recent Screen Captures Gallery */}
      {recentCaptures.length > 0 && (
        <div>
          <span className="text-xs font-semibold text-white/70 block mb-2 px-0.5">Recent Captures</span>
          <div className="flex gap-2.5 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
            {recentCaptures.slice(-6).map((item) => (
              <button
                key={item.id}
                onClick={() => onSelectCapture(item.id)}
                className="shrink-0 group relative rounded-xl overflow-hidden border border-white/10 hover:border-blue-500/50 transition-all active:scale-95"
                title="Click to view in chat"
              >
                <img src={item.previewUrl} alt="Capture" className="w-24 h-16 object-cover" />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <span className="text-[10px] font-semibold text-white bg-blue-600/80 px-2 py-0.5 rounded-full">
                    View
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
