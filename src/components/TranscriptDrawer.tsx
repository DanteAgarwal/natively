import React, { useRef, useEffect } from 'react';
import { Volume2, X, Trash2, ArrowUpRight, MessageSquareQuote } from 'lucide-react';

interface TranscriptItem {
  id: string;
  speaker: 'meeting' | 'user';
  text: string;
  timestamp: number;
}

interface TranscriptDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  transcripts: TranscriptItem[];
  onClear: () => void;
  onAnswerItem: (text: string) => void;
}

export const TranscriptDrawer: React.FC<TranscriptDrawerProps> = ({
  isOpen,
  onClose,
  transcripts,
  onClear,
  onAnswerItem,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [isOpen, transcripts.length]);

  if (!isOpen) return null;

  return (
    <div
      className="shrink-0 max-h-56 flex flex-col bg-zinc-950/95 border-t border-cyan-500/30 shadow-2xl transition-all select-none animate-in slide-in-from-bottom-2 duration-150"
      style={{ backdropFilter: 'blur(20px)' }}
    >
      {/* Drawer Header */}
      <div className="flex items-center justify-between px-3.5 py-2 border-b border-white/[0.06] bg-cyan-950/20">
        <div className="flex items-center gap-2">
          <Volume2 className="w-3.5 h-3.5 text-cyan-400" />
          <span className="text-xs font-semibold text-white">Live Meeting Audio Feed</span>
          <span className="text-[10px] px-1.5 py-0.2 rounded-full font-mono bg-cyan-500/20 text-cyan-300">
            {transcripts.length} items
          </span>
        </div>
        <div className="flex items-center gap-2">
          {transcripts.length > 0 && (
            <button
              onClick={onClear}
              className="flex items-center gap-1 text-[10px] text-zinc-400 hover:text-red-400 transition-colors"
              title="Clear transcript history"
            >
              <Trash2 className="w-3 h-3" />
              <span>Clear</span>
            </button>
          )}
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-white/40 hover:text-white transition-colors"
            title="Close transcript drawer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Transcript Items */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-3 space-y-2 select-text"
        style={{ scrollbarWidth: 'thin' }}
      >
        {transcripts.length === 0 ? (
          <div className="py-6 text-center text-xs text-white/40">
            No meeting audio detected yet. Turn on <strong>Meeting Audio</strong> and start speaking or receiving sound.
          </div>
        ) : (
          transcripts.map((t) => (
            <div
              key={t.id}
              className="group flex items-start justify-between gap-2 p-2 rounded-xl bg-white/[0.03] border border-white/[0.05] hover:border-cyan-500/30 transition-all text-xs"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span
                    className={`text-[10px] font-semibold uppercase tracking-wider ${
                      t.speaker === 'meeting' ? 'text-cyan-400' : 'text-emerald-400'
                    }`}
                  >
                    {t.speaker === 'meeting' ? '🔊 Interviewer' : '🎙️ Candidate'}
                  </span>
                  <span className="text-[9px] font-mono text-white/30">
                    {new Date(t.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </span>
                </div>
                <p className="text-zinc-200 text-xs leading-relaxed break-words">{t.text}</p>
              </div>

              {/* Quick Answer Button */}
              <button
                onClick={() => onAnswerItem(t.text)}
                className="opacity-0 group-hover:opacity-100 shrink-0 p-1.5 rounded-lg bg-blue-600/30 hover:bg-blue-600/50 text-blue-300 border border-blue-500/40 transition-all flex items-center gap-1 text-[10px]"
                title="Send this phrase as prompt to Copilot"
              >
                <ArrowUpRight className="w-3 h-3" />
                <span>Answer</span>
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
