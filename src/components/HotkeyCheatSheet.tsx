import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  X,
  Search,
  Sparkles,
  Play,
  Command,
  Globe,
  Check,
  ShieldCheck,
  Info,
  CheckCircle2,
} from 'lucide-react';
import {
  SHORTCUT_CATALOG,
  SHORTCUT_CATEGORIES,
  ShortcutCategory,
  ShortcutActionId,
  ShortcutDefinition,
} from '../types/shortcuts';

interface HotkeyCheatSheetProps {
  show: boolean;
  onClose: () => void;
  onExecuteAction?: (actionId: ShortcutActionId) => void;
}

export const HotkeyCheatSheet: React.FC<HotkeyCheatSheetProps> = ({
  show,
  onClose,
  onExecuteAction,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<ShortcutCategory | 'all'>('all');
  const [executedActionId, setExecutedActionId] = useState<string | null>(null);
  const [showGuidelines, setShowGuidelines] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus search input when opened
  useEffect(() => {
    if (show) {
      setSearchQuery('');
      setSelectedCategory('all');
      setTimeout(() => inputRef.current?.focus(), 60);
    }
  }, [show]);

  // Filter shortcuts
  const filteredShortcuts = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return SHORTCUT_CATALOG.filter((item) => {
      const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory;
      if (!matchesCategory) return false;

      if (!q) return true;

      const inTitle = item.title.toLowerCase().includes(q);
      const inDesc = item.description.toLowerCase().includes(q);
      const inPrimary = item.primaryKey.toLowerCase().includes(q);
      const inSecondary = item.secondaryKey ? item.secondaryKey.toLowerCase().includes(q) : false;

      return inTitle || inDesc || inPrimary || inSecondary;
    });
  }, [searchQuery, selectedCategory]);

  const handleRun = (item: ShortcutDefinition) => {
    setExecutedActionId(item.id);
    setTimeout(() => {
      setExecutedActionId(null);
      onClose();
      onExecuteAction?.(item.id);
    }, 220);
  };

  const renderKeyTokens = (keyString: string, isSecondary = false) => {
    const tokens = keyString.split('+').map((s) => s.trim());
    return (
      <div className={`flex items-center gap-1.5 ${isSecondary ? 'opacity-65' : ''}`}>
        {tokens.map((token, idx) => (
          <React.Fragment key={idx}>
            <kbd
              className={`inline-flex items-center justify-center font-mono font-semibold rounded-lg shadow-sm border transition-all ${
                isSecondary
                  ? 'px-2 py-0.5 text-[10px] bg-zinc-900/90 text-zinc-300 border-zinc-700/60'
                  : 'px-2.5 py-1 text-[11px] bg-gradient-to-b from-zinc-800 to-zinc-900 text-zinc-100 border-zinc-600/70 shadow-zinc-950/40'
              }`}
            >
              {token}
            </kbd>
            {idx < tokens.length - 1 && (
              <span className="text-zinc-500 text-[10px] font-mono select-none">+</span>
            )}
          </React.Fragment>
        ))}
      </div>
    );
  };

  if (!show) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 select-none animate-in fade-in duration-150"
      style={{
        background: 'rgba(5, 7, 12, 0.82)',
        backdropFilter: 'blur(20px)',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* Spotlight Window Card - Uncongested & Roomy */}
      <div
        className="w-full max-w-2xl max-h-[88vh] flex flex-col rounded-2xl overflow-hidden shadow-2xl border border-white/[0.12] transition-all"
        style={{
          background: 'rgba(15, 17, 26, 0.97)',
          boxShadow: '0 30px 80px rgba(0,0,0,0.95), 0 0 0 1px rgba(255,255,255,0.08)',
        }}
      >
        {/* 1. Header with Title & Quick Info */}
        <div className="shrink-0 p-4 pb-3 border-b border-white/[0.08] bg-white/[0.02]">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-blue-400 shadow-inner">
                <Command className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-white tracking-wide">
                    Essential Shortcuts
                  </h3>
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-mono bg-blue-500/20 text-blue-300 border border-blue-500/30">
                    {SHORTCUT_CATALOG.length} Curated
                  </span>
                  <span className="hidden sm:inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-mono bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                    <CheckCircle2 className="w-2.5 h-2.5" /> Working & Verified
                  </span>
                </div>
                <p className="text-[11px] text-white/40 mt-0.5">
                  High-frequency actions tuned for interviews & meeting copilot
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setShowGuidelines((prev) => !prev)}
                className={`p-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1 border ${
                  showGuidelines
                    ? 'bg-blue-500/20 text-blue-300 border-blue-500/40'
                    : 'text-white/40 hover:text-white/80 hover:bg-white/[0.06] border-transparent'
                }`}
                title="View shortcut design guidelines"
              >
                <Info className="w-3.5 h-3.5" />
                <span className="hidden sm:inline text-[11px]">Guidelines</span>
              </button>

              <button
                onClick={onClose}
                className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/[0.08] transition-all"
                title="Close (Esc)"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Guidelines Dropdown Accordion */}
          {showGuidelines && (
            <div className="mb-3 p-3 rounded-xl bg-blue-950/30 border border-blue-500/25 text-[11px] text-blue-200/90 space-y-1.5 animate-in fade-in duration-150">
              <div className="font-semibold flex items-center gap-1.5 text-blue-300">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Why this pruned, uncongested list?</span>
              </div>
              <ul className="list-disc list-inside space-y-1 text-white/60 pl-1 leading-relaxed">
                <li>
                  <strong className="text-white/80">Zero False Triggers:</strong> We removed 14 low-frequency shortcuts (tab switching, cycling models, settings) to avoid accidental triggers during tense live coding rounds.
                </li>
                <li>
                  <strong className="text-white/80">Global Zoom/Meet Intercept:</strong> Alt+S, Alt+W, Alt+R, Alt+F, Alt+K, Alt+M, and F9 are registered at the Windows OS level — they fire even when typing into another app or presenting.
                </li>
                <li>
                  <strong className="text-white/80">Instant Verification:</strong> Click any shortcut’s <code className="text-blue-300">Run</code> button below to test that its action is connected and operational.
                </li>
              </ul>
            </div>
          )}

          {/* Search Box */}
          <div className="relative flex items-center">
            <Search className="w-4 h-4 text-white/35 absolute left-3.5 pointer-events-none" />
            <input
              ref={inputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by action name, description, or key (e.g. 'what to answer', 'Alt+S', 'F9')..."
              className="w-full pl-10 pr-12 py-2 rounded-xl text-xs bg-white/[0.05] border border-white/[0.08] focus:border-blue-500/60 focus:bg-white/[0.08] text-white placeholder-white/30 outline-none transition-all shadow-inner"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 text-white/40 hover:text-white text-xs font-medium"
              >
                Clear
              </button>
            )}
          </div>

          {/* Category Filter Tabs */}
          <div className="flex items-center gap-2 overflow-x-auto pt-3" style={{ scrollbarWidth: 'none' }}>
            {SHORTCUT_CATEGORIES.map((cat) => {
              const isSelected = selectedCategory === cat.id;
              const count =
                cat.id === 'all'
                  ? SHORTCUT_CATALOG.length
                  : SHORTCUT_CATALOG.filter((i) => i.category === cat.id).length;

              return (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`shrink-0 flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    isSelected
                      ? 'bg-blue-600/30 text-blue-200 border border-blue-500/40 shadow-sm'
                      : 'bg-white/[0.03] text-white/45 border border-white/[0.05] hover:text-white/80 hover:bg-white/[0.06]'
                  }`}
                >
                  <span>{cat.icon}</span>
                  <span>{cat.label}</span>
                  <span className="text-[10px] opacity-60 font-mono">({count})</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 2. Scrollable Shortcut List - Spacious & Uncongested */}
        <div
          className="flex-1 overflow-y-auto p-3.5 space-y-2.5 min-h-60"
          style={{ scrollbarWidth: 'thin' }}
        >
          {filteredShortcuts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-14 text-center text-white/40">
              <Command className="w-10 h-10 stroke-[1.2] mb-3 opacity-25" />
              <p className="text-xs">No shortcuts matching &quot;{searchQuery}&quot;</p>
              <button
                onClick={() => setSearchQuery('')}
                className="mt-2 text-xs text-blue-400 hover:underline"
              >
                Reset search filter
              </button>
            </div>
          ) : (
            filteredShortcuts.map((item) => {
              const isExecuting = executedActionId === item.id;
              return (
                <div
                  key={item.id}
                  onClick={() => handleRun(item)}
                  className={`group relative flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl border transition-all cursor-pointer ${
                    isExecuting
                      ? 'bg-blue-600/25 border-blue-500/70 scale-[0.99] shadow-lg'
                      : 'bg-white/[0.025] hover:bg-white/[0.06] border-white/[0.06] hover:border-white/[0.14]'
                  }`}
                >
                  {/* Left: Icon, Title, Badges & Clean Description */}
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <div className="w-8 h-8 rounded-lg bg-white/[0.04] border border-white/[0.08] flex items-center justify-center shrink-0 text-base shadow-sm group-hover:scale-105 transition-transform">
                      {item.icon}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-semibold text-white group-hover:text-blue-300 transition-colors">
                          {item.title}
                        </span>

                        {item.badge && (
                          <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-md bg-blue-500/20 text-blue-300 border border-blue-500/30">
                            {item.badge}
                          </span>
                        )}

                        {item.isGlobal ? (
                          <span className="inline-flex items-center gap-1 text-[9px] font-mono px-1.5 py-0.5 rounded-md bg-cyan-500/15 border border-cyan-500/30 text-cyan-300">
                            <Globe className="w-2.5 h-2.5" /> GLOBAL
                          </span>
                        ) : (
                          <span className="text-[9px] font-mono px-1.5 py-0.5 rounded-md bg-white/[0.06] text-white/40">
                            APP
                          </span>
                        )}
                      </div>

                      <p className="text-[11px] text-white/50 mt-1 leading-relaxed group-hover:text-white/70 transition-colors">
                        {item.description}
                      </p>
                    </div>
                  </div>

                  {/* Right: Keycaps & Run Verification Button */}
                  <div className="shrink-0 flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-white/[0.04]">
                    <div className="flex items-center gap-2 flex-wrap">
                      {/* Primary Keys */}
                      {renderKeyTokens(item.primaryKey)}

                      {/* Secondary Keys */}
                      {item.secondaryKey && (
                        <div className="flex items-center gap-1.5">
                          <span className="text-white/25 text-[10px] font-medium">or</span>
                          {renderKeyTokens(item.secondaryKey, true)}
                        </div>
                      )}
                    </div>

                    {/* Interactive "Run / Test" Verification Button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRun(item);
                      }}
                      className="px-2.5 py-1.5 rounded-lg text-[10px] font-semibold bg-blue-600/30 hover:bg-blue-600 text-blue-200 hover:text-white border border-blue-400/40 transition-all flex items-center gap-1.5 shadow-sm shrink-0"
                      title="Run action now to verify"
                    >
                      {isExecuting ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-300 animate-in zoom-in" />
                          <span className="text-emerald-200">Dispatched</span>
                        </>
                      ) : (
                        <>
                          <Play className="w-2.5 h-2.5 fill-current opacity-80" />
                          <span>Run</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* 3. Footer with Status & Tips */}
        <div className="shrink-0 px-4 py-3 bg-black/45 border-t border-white/[0.06] flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] text-white/40">
          <div className="flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>
              <strong className="text-white/70">Global Intercept Active:</strong> Alt+ shortcuts work while focused on Zoom, Meet, Teams, or VS Code.
            </span>
          </div>

          <div className="flex items-center gap-3 font-mono text-[10px]">
            <span>
              <kbd className="px-1.5 py-0.5 rounded bg-white/10 text-white/70 font-sans">Click</kbd> to test
            </span>
            <span>
              <kbd className="px-1.5 py-0.5 rounded bg-white/10 text-white/70 font-sans">Esc</kbd> to close
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
