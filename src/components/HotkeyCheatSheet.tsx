import React from 'react';
import { X } from 'lucide-react';

interface HotkeyCheatSheetProps {
  show: boolean;
  onClose: () => void;
}

export const HotkeyCheatSheet: React.FC<HotkeyCheatSheetProps> = ({ show, onClose }) => {
  if (!show) return null;

  return (
    <div
      className="shrink-0 px-4 py-3.5 border-b text-[11px] max-h-60 overflow-y-auto"
      style={{
        borderColor: 'rgba(255,255,255,0.06)',
        background: 'rgba(15, 23, 42, 0.75)',
        color: 'rgba(255,255,255,0.7)',
        scrollbarWidth: 'thin',
      }}
    >
      <div className="flex items-center justify-between mb-2.5 pb-1 border-b border-white/5">
        <span className="text-[12px] font-bold text-white flex items-center gap-1.5">
          ⌨️ Complete Keyboard Shortcuts (Mouse-Free Copilot)
        </span>
        <button
          onClick={onClose}
          className="text-zinc-400 hover:text-white p-0.5"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-[10px]">
        <div>
          <div className="font-semibold text-cyan-400 mb-1 flex items-center gap-1">🎙️ Speech & Vision</div>
          <div className="space-y-1">
            <div><kbd className="px-1 py-0.5 rounded bg-zinc-800 text-zinc-200 border border-zinc-700">Alt+S</kbd> Capture Screen</div>
            <div><kbd className="px-1 py-0.5 rounded bg-zinc-800 text-zinc-200 border border-zinc-700">Alt+L / F9</kbd> Mic Dictate</div>
            <div><kbd className="px-1 py-0.5 rounded bg-zinc-800 text-zinc-200 border border-zinc-700">Alt+M</kbd> Sync Meeting</div>
            <div><kbd className="px-1 py-0.5 rounded bg-zinc-800 text-zinc-200 border border-zinc-700">Alt+T</kbd> Transcripts Drawer</div>
          </div>
        </div>
        <div>
          <div className="font-semibold text-emerald-400 mb-1 flex items-center gap-1">🎯 Meeting Actions</div>
          <div className="space-y-1">
            <div><kbd className="px-1 py-0.5 rounded bg-zinc-800 text-zinc-200 border border-zinc-700">Alt+U / J</kbd> Resume & JD Persona</div>
            <div><kbd className="px-1 py-0.5 rounded bg-zinc-800 text-zinc-200 border border-zinc-700">Alt+W</kbd> What to answer?</div>
            <div><kbd className="px-1 py-0.5 rounded bg-zinc-800 text-zinc-200 border border-zinc-700">Alt+R</kbd> Recap Meeting</div>
            <div><kbd className="px-1 py-0.5 rounded bg-zinc-800 text-zinc-200 border border-zinc-700">Alt+F</kbd> Follow Up Questions</div>
            <div><kbd className="px-1 py-0.5 rounded bg-zinc-800 text-zinc-200 border border-zinc-700">Alt+K</kbd> Shorten to Bullets</div>
          </div>
        </div>
        <div>
          <div className="font-semibold text-indigo-400 mb-1 flex items-center gap-1">⚡ Chat & Navigation</div>
          <div className="space-y-1">
            <div><kbd className="px-1 py-0.5 rounded bg-zinc-800 text-zinc-200 border border-zinc-700">/ or Alt+/</kbd> Focus Input</div>
            <div><kbd className="px-1 py-0.5 rounded bg-zinc-800 text-zinc-200 border border-zinc-700">Alt+1 / 2</kbd> Switch Tabs</div>
            <div><kbd className="px-1 py-0.5 rounded bg-zinc-800 text-zinc-200 border border-zinc-700">Alt+C</kbd> Copy Answer</div>
            <div><kbd className="px-1 py-0.5 rounded bg-zinc-800 text-zinc-200 border border-zinc-700">Alt+E</kbd> Export Session</div>
            <div><kbd className="px-1 py-0.5 rounded bg-zinc-800 text-zinc-200 border border-zinc-700">Ctrl+K</kbd> Clear Chat</div>
          </div>
        </div>
        <div>
          <div className="font-semibold text-amber-400 mb-1 flex items-center gap-1">🛡️ Window & Stealth</div>
          <div className="space-y-1">
            <div><kbd className="px-1 py-0.5 rounded bg-zinc-800 text-zinc-200 border border-zinc-700">Alt+B</kbd> Big ↔ Normal Size</div>
            <div><kbd className="px-1 py-0.5 rounded bg-zinc-800 text-zinc-200 border border-zinc-700">Alt+P</kbd> Cycle Provider</div>
            <div><kbd className="px-1 py-0.5 rounded bg-zinc-800 text-zinc-200 border border-zinc-700">Alt+X</kbd> Click-Through</div>
            <div><kbd className="px-1 py-0.5 rounded bg-zinc-800 text-zinc-200 border border-zinc-700">Alt+G</kbd> Ghost Shield (Locked ON)</div>
            <div><kbd className="px-1 py-0.5 rounded bg-zinc-800 text-zinc-200 border border-zinc-700">Esc</kbd> Cancel / Dismiss</div>
          </div>
        </div>
      </div>
    </div>
  );
};
