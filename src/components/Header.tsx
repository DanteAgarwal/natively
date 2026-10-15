import React from 'react';
import {
  Shield,
  MousePointer,
  Sparkles,
  GripHorizontal,
  Maximize2,
  Info,
  Briefcase,
  Settings,
  ChevronDown,
  Minus,
  EyeOff,
  X,
} from 'lucide-react';
import { AppConfig } from '../types/config';

interface HeaderProps {
  isGhostActive: boolean;
  onToggleGhostMode: () => void;
  isClickThrough: boolean;
  onToggleClickThrough: () => void;
  config: AppConfig;
  onCycleProvider: () => void;
  isBigOverlay: boolean;
  onToggleWindowSize: () => void;
  showShortcuts: boolean;
  onToggleShortcuts: () => void;
  onOpenContextModal: () => void;
  onOpenSettings: () => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onMinimize: () => void;
  onClose: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  isGhostActive,
  onToggleGhostMode,
  isClickThrough,
  onToggleClickThrough,
  config,
  onCycleProvider,
  isBigOverlay,
  onToggleWindowSize,
  showShortcuts,
  onToggleShortcuts,
  onOpenContextModal,
  onOpenSettings,
  isCollapsed,
  onToggleCollapse,
  onMinimize,
  onClose,
}) => {
  return (
    <div
      className="titlebar-drag-region shrink-0 h-12 px-3 flex items-center justify-between border-b"
      style={{
        borderColor: 'rgba(255,255,255,0.06)',
        background: 'rgba(255,255,255,0.015)',
        position: 'relative',
        zIndex: 10,
      }}
      onMouseEnter={() => {
        if (isClickThrough) window.ghostAPI?.setIgnoreMouseEvents(false);
      }}
      onMouseLeave={() => {
        if (isClickThrough) window.ghostAPI?.setIgnoreMouseEvents(true, { forward: true });
      }}
    >
      {/* Left: Ghost Status Badge */}
      <div className="flex items-center gap-2 no-drag">
        <button
          onClick={onToggleGhostMode}
          title="Ghost Shield Locked ON — 100% invisible in Zoom, Meet, Teams, OBS (Protection is permanently locked on)"
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium transition-all duration-200"
          style={{
            background: 'rgba(16,185,129,0.1)',
            border: '1px solid rgba(16,185,129,0.25)',
            color: '#34d399',
          }}
        >
          <span
            className="w-1.5 h-1.5 rounded-full"
            style={{
              background: '#34d399',
              animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
            }}
          />
          <Shield className="w-3 h-3" />
          <span>Ghost Shield (Locked ON)</span>
        </button>

        {/* Click-Through Mode Toggle */}
        <button
          onClick={onToggleClickThrough}
          title={
            isClickThrough
              ? 'Click-Through ON — mouse clicks pass to apps behind (Alt+X / Ctrl+Shift+X)'
              : 'Enable Click-Through pass-through (Alt+X / Ctrl+Shift+X)'
          }
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium transition-all duration-200"
          style={{
            background: isClickThrough ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.04)',
            border: `1px solid ${isClickThrough ? 'rgba(99,102,241,0.45)' : 'rgba(255,255,255,0.08)'}`,
            color: isClickThrough ? '#a5b4fc' : 'rgba(255,255,255,0.4)',
          }}
        >
          <MousePointer className="w-3 h-3" />
          <span>{isClickThrough ? 'Pass-Thru ON' : 'Click-Thru'}</span>
        </button>

        {/* Model tag button */}
        <button
          onClick={onCycleProvider}
          title="Click or press Alt+P to cycle AI Provider (Gemini / Groq / OpenRouter / Router)"
          className="flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full transition-all hover:scale-105"
          style={{
            background:
              config.provider === 'groq'
                ? 'rgba(249, 115, 22, 0.15)'
                : config.provider === 'openrouter'
                  ? 'rgba(168, 85, 247, 0.15)'
                  : config.provider === 'router'
                    ? 'rgba(16, 185, 129, 0.15)'
                    : 'rgba(59, 130, 246, 0.15)',
            color:
              config.provider === 'groq'
                ? '#fdba74'
                : config.provider === 'openrouter'
                  ? '#d8b4fe'
                  : config.provider === 'router'
                    ? '#6ee7b7'
                    : '#93c5fd',
            border:
              config.provider === 'groq'
                ? '1px solid rgba(249, 115, 22, 0.35)'
                : config.provider === 'openrouter'
                  ? '1px solid rgba(168, 85, 247, 0.35)'
                  : config.provider === 'router'
                    ? '1px solid rgba(16, 185, 129, 0.35)'
                    : '1px solid rgba(59, 130, 246, 0.35)',
          }}
        >
          <Sparkles className="w-2.5 h-2.5" />
          <span>
            {config.provider === 'groq'
              ? `groq:${config.groqModel.split('-')[0]}`
              : config.provider === 'openrouter'
                ? `openrouter:${config.openrouterModel.replace(':free', '').split('/').pop()?.slice(0, 10)}`
                : config.provider === 'router'
                  ? `router:${config.routerPreset || 'custom'}`
                  : config.model.split('-').slice(0, 2).join('-')}
          </span>
          <span className="opacity-60 text-[9px] font-mono ml-0.5">Alt+P</span>
        </button>
      </div>

      {/* Center: Drag grip visual */}
      <div className="absolute left-1/2 -translate-x-1/2 pointer-events-none">
        <GripHorizontal className="w-4 h-4" style={{ color: 'rgba(255,255,255,0.12)' }} />
      </div>

      {/* Right: Window Controls */}
      <div className="flex items-center gap-0.5 no-drag">
        <button
          onClick={onToggleWindowSize}
          className="p-1.5 rounded-lg transition-colors hover:bg-white/5"
          style={{ color: isBigOverlay ? '#38bdf8' : 'rgba(255,255,255,0.35)' }}
          title={isBigOverlay ? 'Standard overlay size (Alt+B / Ctrl+Shift+B)' : 'Expand overlay screen size (Alt+B / Ctrl+Shift+B)'}
        >
          <Maximize2 className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={onToggleShortcuts}
          className="p-1.5 rounded-lg transition-colors hover:bg-white/5"
          style={{ color: showShortcuts ? '#38bdf8' : 'rgba(255,255,255,0.35)' }}
          title="Keyboard shortcuts cheatsheet (Press ? or F1)"
        >
          <Info className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={onOpenContextModal}
          className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium transition-all hover:bg-white/5"
          style={{
            background: config.userProfileContext?.enabled ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255, 255, 255, 0.04)',
            border: config.userProfileContext?.enabled ? '1px solid rgba(16, 185, 129, 0.35)' : '1px solid rgba(255, 255, 255, 0.08)',
            color: config.userProfileContext?.enabled ? '#34d399' : 'rgba(255, 255, 255, 0.45)',
          }}
          title="Candidate Persona (Resume, JD, Audience) [Alt+U / Alt+J]"
        >
          <Briefcase className="w-3.5 h-3.5 text-emerald-400" />
          <span className="hidden sm:inline">
            {config.userProfileContext?.enabled
              ? (config.userProfileContext.targetRole || config.userProfileContext.candidateTitle || 'Persona')
              : 'Resume & JD'}
          </span>
          {config.userProfileContext?.enabled && (
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          )}
        </button>
        <button
          onClick={onOpenSettings}
          className="p-1.5 rounded-lg transition-colors hover:bg-white/5"
          style={{ color: 'rgba(255,255,255,0.35)' }}
          title="Settings & API Key (Ctrl+, / Alt+,)"
        >
          <Settings className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={onToggleCollapse}
          className="p-1.5 rounded-lg transition-colors hover:bg-white/5"
          style={{ color: 'rgba(255,255,255,0.35)' }}
          title={isCollapsed ? 'Expand overlay' : 'Collapse to mini bar'}
        >
          {isCollapsed ? <ChevronDown className="w-3.5 h-3.5" /> : <Minus className="w-3.5 h-3.5" />}
        </button>
        <button
          onClick={onMinimize}
          className="p-1.5 rounded-lg transition-colors hover:bg-white/5"
          style={{ color: 'rgba(255,255,255,0.25)' }}
          title="Hide Overlay (Ctrl+\ to restore / Esc)"
        >
          <EyeOff className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg transition-colors ml-1 hover:bg-red-500/10"
          style={{ color: 'rgba(239,68,68,0.6)' }}
          title="Quit App"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};

export default Header;
