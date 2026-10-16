import React from 'react';
import {
  Sparkles,
  Briefcase,
  Volume2,
  ScanLine,
  MessageSquare,
  MousePointer,
  Zap,
  Download,
  Trash2,
} from 'lucide-react';
import { AppConfig, AssistantMode, ASSISTANT_MODES, ActiveTab } from '../types/config';

interface ContextBarProps {
  config: AppConfig;
  assistantMode: AssistantMode;
  onSelectMode: (mode: AssistantMode) => void;
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  messageCount: number;
  isMeetingListening: boolean;
  transcriptCount: number;
  onToggleTranscriptDrawer: () => void;
  showTranscriptDrawer: boolean;
  onOpenContextModal: () => void;
  isClickThrough: boolean;
  onToggleClickThrough: () => void;
  hasApiKey: boolean;
  onOpenSettings: () => void;
  onExportSession?: () => void;
  onClearMessages?: () => void;
  windowOpacity?: number;
  onChangeOpacity?: (opacity: number) => void;
  exportNotice?: string | null;
}

export const ContextBar: React.FC<ContextBarProps> = ({
  config,
  assistantMode,
  onSelectMode,
  activeTab,
  onSelectTab,
  messageCount,
  isMeetingListening,
  transcriptCount,
  onToggleTranscriptDrawer,
  showTranscriptDrawer,
  onOpenContextModal,
  isClickThrough,
  onToggleClickThrough,
  hasApiKey,
  onOpenSettings,
  onExportSession,
  onClearMessages,
  windowOpacity = 0.97,
  onChangeOpacity,
  exportNotice,
}) => {
  const profile = config.userProfileContext;
  const isProfileActive = profile && profile.enabled;

  return (
    <div className="shrink-0 flex flex-col gap-1.5 px-3 py-2 border-b border-white/[0.06] bg-black/20 select-none">
      {/* Top Row: Tab Switcher & Secondary Badges */}
      <div className="flex items-center justify-between gap-2">
        {/* Main Tabs (Chat vs Screen AI) */}
        <div className="flex items-center p-0.5 rounded-xl bg-white/[0.04] border border-white/[0.06]">
          <button
            onClick={() => onSelectTab('chat')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition-all ${
              activeTab === 'chat'
                ? 'bg-blue-600/30 text-blue-300 shadow-sm border border-blue-500/30'
                : 'text-white/40 hover:text-white/70 border border-transparent'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Chat</span>
            {messageCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-blue-500/20 text-blue-300">
                {messageCount}
              </span>
            )}
            <kbd className="hidden sm:inline font-mono text-[9px] opacity-40 ml-0.5">Alt+1</kbd>
          </button>

          <button
            onClick={() => onSelectTab('capture')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition-all ${
              activeTab === 'capture'
                ? 'bg-blue-600/30 text-blue-300 shadow-sm border border-blue-500/30'
                : 'text-white/40 hover:text-white/70 border border-transparent'
            }`}
          >
            <ScanLine className="w-3.5 h-3.5" />
            <span>Screen Vision</span>
            <kbd className="hidden sm:inline font-mono text-[9px] opacity-40 ml-0.5">Alt+2</kbd>
          </button>
        </div>

        {/* Right Badges: Persona Context & System Status */}
        <div className="flex items-center gap-1.5 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
          {/* Missing API Key Pill */}
          {!hasApiKey && (
            <button
              onClick={onOpenSettings}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-amber-500/15 border border-amber-500/30 text-amber-300 hover:bg-amber-500/25 transition-all animate-pulse"
            >
              <Zap className="w-3 h-3 text-amber-400" />
              <span>Set API Key</span>
            </button>
          )}

          {/* Click-Through Active Indicator */}
          {isClickThrough && (
            <button
              onClick={onToggleClickThrough}
              className="flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-medium bg-indigo-500/20 border border-indigo-500/40 text-indigo-300 hover:bg-indigo-500/30 transition-all"
              title="Click-Through pass-through active. Clicks go to apps behind. Press Alt+X to disable."
            >
              <MousePointer className="w-3 h-3 text-indigo-400 animate-pulse" />
              <span>Pass-Thru Active</span>
            </button>
          )}

          {/* Meeting Loopback Audio Status Badge */}
          {isMeetingListening && (
            <button
              onClick={onToggleTranscriptDrawer}
              className={`flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-medium transition-all ${
                showTranscriptDrawer
                  ? 'bg-cyan-500/30 border border-cyan-400/50 text-cyan-200'
                  : 'bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/25'
              }`}
              title="Interviewer speaker loopback active via WASAPI. Click to view transcript."
            >
              <Volume2 className="w-3 h-3 text-cyan-400 animate-pulse" />
              <span>Meeting Audio</span>
              {transcriptCount > 0 && (
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
              )}
            </button>
          )}

          {/* Persona / Resume & JD Context Badge */}
          <button
            onClick={onOpenContextModal}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all ${
              isProfileActive
                ? 'bg-emerald-500/15 border border-emerald-500/35 text-emerald-300 hover:bg-emerald-500/25'
                : 'bg-white/[0.04] border border-white/[0.08] text-white/50 hover:text-white hover:bg-white/[0.07]'
            }`}
            title="Configure or view candidate resume, JD & audience persona (Alt+U)"
          >
            <Briefcase className={`w-3 h-3 ${isProfileActive ? 'text-emerald-400' : 'text-white/40'}`} />
            <span className="truncate max-w-[140px]">
              {isProfileActive
                ? (profile.targetRole || profile.candidateTitle || 'Candidate Persona')
                : 'Resume & JD'}
            </span>
            {isProfileActive && (
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            )}
          </button>
        </div>
      </div>

      {/* Bottom Row: Segmented Assistant Mode Pills & Session Controls */}
      <div className="flex items-center justify-between gap-2 pt-0.5 select-none">
        <div className="flex items-center gap-1 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
          <span className="text-[10px] font-mono uppercase tracking-wider text-white/30 mr-1 shrink-0">
            Mode
          </span>
          {ASSISTANT_MODES.map((mode) => {
            const isSelected = assistantMode === mode.id;
            return (
              <button
                key={mode.id}
                onClick={() => onSelectMode(mode.id)}
                className={`flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[11px] font-medium transition-all shrink-0 ${
                  isSelected
                    ? 'bg-white/[0.12] text-white border border-white/[0.2] shadow-xs'
                    : 'bg-white/[0.02] text-white/45 border border-white/[0.04] hover:text-white/80 hover:bg-white/[0.06]'
                }`}
                title={mode.prompt}
              >
                <span className="text-xs leading-none">{mode.icon}</span>
                <span>{mode.label}</span>
              </button>
            );
          })}
        </div>

        {/* Right Session Utilities */}
        <div className="flex items-center gap-1.5 shrink-0 ml-auto">
          {exportNotice && (
            <span className="text-[10px] text-emerald-400 font-medium px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20">
              {exportNotice}
            </span>
          )}

          {messageCount > 0 && onExportSession && (
            <button
              onClick={onExportSession}
              className="flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] text-white/60 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] transition-all"
              title="Export Conversation to Markdown (Alt+E)"
            >
              <Download className="w-2.5 h-2.5" />
              <span>Export</span>
              <kbd className="hidden sm:inline font-mono text-[8px] opacity-40">Alt+E</kbd>
            </button>
          )}

          {messageCount > 0 && onClearMessages && (
            <button
              onClick={onClearMessages}
              className="p-1 rounded-lg text-white/30 hover:text-red-400 hover:bg-red-500/10 transition-colors"
              title="Clear Session Messages (Ctrl+K)"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          )}

          {onChangeOpacity && (
            <div className="flex items-center gap-1 pl-1.5 border-l border-white/[0.08]">
              <span className="text-[9px] font-mono text-white/25">Op</span>
              <input
                type="range"
                min="0.3"
                max="1"
                step="0.05"
                value={windowOpacity}
                onChange={(e) => onChangeOpacity(parseFloat(e.target.value))}
                className="w-12 h-1 appearance-none rounded cursor-pointer"
                style={{ accentColor: '#3b82f6' }}
                title={`Window Opacity: ${Math.round(windowOpacity * 100)}%`}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
