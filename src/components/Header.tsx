import React from 'react';
import {
  Shield,
  MousePointer,
  Sparkles,
  GripHorizontal,
  Maximize2,
  HelpCircle,
  Briefcase,
  Settings,
  ChevronDown,
  Minus,
  EyeOff,
  X,
  Volume2,
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
  const isConfigured =
    config.provider === 'gemini'
      ? !!config.geminiApiKey?.trim()
      : config.provider === 'groq'
        ? !!config.groqApiKey?.trim()
        : config.provider === 'openrouter'
          ? !!config.openrouterApiKey?.trim()
          : (config.routerPreset === 'pollinations' || !!config.routerBaseUrl?.trim());

  const getProviderTheme = () => {
    switch (config.provider) {
      case 'groq':
        return {
          bg: 'rgba(249, 115, 22, 0.12)',
          border: 'rgba(249, 115, 22, 0.3)',
          text: '#fdba74',
          label: `groq:${config.groqModel.split('-')[0]}`,
        };
      case 'openrouter':
        return {
          bg: 'rgba(168, 85, 247, 0.12)',
          border: 'rgba(168, 85, 247, 0.3)',
          text: '#d8b4fe',
          label: `openrouter:${config.openrouterModel.replace(':free', '').split('/').pop()?.slice(0, 10)}`,
        };
      case 'router':
        return {
          bg: 'rgba(16, 185, 129, 0.12)',
          border: 'rgba(16, 185, 129, 0.3)',
          text: '#6ee7b7',
          label: `router:${config.routerPreset || 'custom'}`,
        };
      default:
        return {
          bg: 'rgba(59, 130, 246, 0.12)',
          border: 'rgba(59, 130, 246, 0.3)',
          text: '#93c5fd',
          label: config.model.split('-').slice(0, 2).join('-'),
        };
    }
  };

  const theme = getProviderTheme();

  return (
    <div
      className="titlebar-drag-region shrink-0 h-11 px-3 flex items-center justify-between border-b border-white/[0.06] bg-black/40 backdrop-blur-md relative select-none"
      onMouseEnter={() => {
        if (isClickThrough) window.ghostAPI?.setIgnoreMouseEvents(false);
      }}
      onMouseLeave={() => {
        if (isClickThrough) window.ghostAPI?.setIgnoreMouseEvents(true, { forward: true });
      }}
    >
      {/* ── Left Cluster: Stealth Badge & Provider Pill ── */}
      <div className="flex items-center gap-1.5 no-drag">
        {/* Ghost Shield Capsule */}
        <div
          title="Ghost Shield Locked ON — 100% invisible on Zoom, Google Meet, MS Teams, OBS & Discord screen share"
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-emerald-500/10 border border-emerald-500/25 text-emerald-300 shadow-xs cursor-default"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)] animate-pulse" />
          <Shield className="w-3 h-3 text-emerald-400" />
          <span className="tracking-tight">Ghost Stealth</span>
        </div>

        {/* AI Provider Switcher Chip */}
        <button
          onClick={onCycleProvider}
          title={`Active AI: ${config.provider.toUpperCase()} (${isConfigured ? 'Ready & Connected' : 'Key Needed'}) — Press Alt+P to switch`}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono transition-all hover:scale-105 active:scale-95 shadow-xs"
          style={{
            background: theme.bg,
            border: `1px solid ${theme.border}`,
            color: theme.text,
          }}
        >
          <span
            className="w-1.5 h-1.5 rounded-full shrink-0"
            style={{
              background: isConfigured ? '#34d399' : '#f59e0b',
              boxShadow: isConfigured ? '0 0 6px rgba(52,211,153,0.8)' : '0 0 6px rgba(245,158,11,0.8)',
            }}
          />
          <Sparkles className="w-2.5 h-2.5" />
          <span className="font-semibold">{theme.label}</span>
          <span className="opacity-50 text-[9px] font-mono">Alt+P</span>
        </button>
      </div>

      {/* ── Center: Minimal Grip Handle ── */}
      <div className="absolute left-1/2 -translate-x-1/2 pointer-events-none opacity-20 hover:opacity-40 transition-opacity">
        <GripHorizontal className="w-4 h-4 text-white" />
      </div>

      {/* ── Right Cluster: Glass Window Action Group ── */}
      <div className="flex items-center gap-1 no-drag">
        {/* Resize Overlay Size Toggle */}
        <button
          onClick={onToggleWindowSize}
          className={`p-1.5 rounded-lg transition-all ${
            isBigOverlay ? 'text-blue-400 bg-blue-500/15' : 'text-white/40 hover:text-white hover:bg-white/5'
          }`}
          title={isBigOverlay ? 'Switch to Standard Size (640x720) [Alt+B]' : 'Expand Screen Size (800x880) [Alt+B]'}
        >
          <Maximize2 className="w-3.5 h-3.5" />
        </button>

        {/* Shortcuts Cheatsheet */}
        <button
          onClick={onToggleShortcuts}
          className={`p-1.5 rounded-lg transition-all ${
            showShortcuts ? 'text-blue-400 bg-blue-500/15' : 'text-white/40 hover:text-white hover:bg-white/5'
          }`}
          title="Keyboard shortcuts guide (Press ? or F1)"
        >
          <HelpCircle className="w-3.5 h-3.5" />
        </button>

        {/* Settings Dialog */}
        <button
          onClick={onOpenSettings}
          className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/5 transition-all"
          title="Settings & Model Config [Ctrl+,]"
        >
          <Settings className="w-3.5 h-3.5" />
        </button>

        <div className="w-px h-3.5 bg-white/10 mx-0.5" />

        {/* Collapse Window */}
        <button
          onClick={onToggleCollapse}
          className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/5 transition-all"
          title={isCollapsed ? 'Expand overlay' : 'Collapse to compact bar'}
        >
          {isCollapsed ? <ChevronDown className="w-3.5 h-3.5" /> : <Minus className="w-3.5 h-3.5" />}
        </button>

        {/* Hide Overlay (Stealth Boss Key) */}
        <button
          onClick={onMinimize}
          className="p-1.5 rounded-lg text-white/40 hover:text-amber-400 hover:bg-amber-500/10 transition-all"
          title="Instant Hide (Ctrl+\ to toggle visibility / Esc)"
        >
          <EyeOff className="w-3.5 h-3.5" />
        </button>

        {/* Close App */}
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg text-white/40 hover:text-red-400 hover:bg-red-500/10 transition-all ml-0.5"
          title="Quit Natively"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};

export default Header;
