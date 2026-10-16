import React, { useRef, useEffect } from 'react';
import {
  Send,
  Camera,
  Mic,
  MicOff,
  StopCircle,
  Loader2,
  Sparkles,
  ListOrdered,
  Volume2,
} from 'lucide-react';

interface CommandDockProps {
  inputPrompt: string;
  setInputPrompt: (val: string) => void;
  onSendMessage: () => void;
  onCaptureAndAnalyze: () => void;
  isStreaming: boolean;
  onStopStream: () => void;
  hasApiKey: boolean;
  isListening: boolean;
  isTranscribing: boolean;
  onToggleListening: () => void;
  onWhatToAnswer: () => void;
  onRecap: () => void;
  onFollowUp: () => void;
  onShorten: () => void;
  transcriptCount: number;
  showTranscriptDrawer: boolean;
  onToggleTranscriptDrawer: () => void;
}

export const CommandDock: React.FC<CommandDockProps> = ({
  inputPrompt,
  setInputPrompt,
  onSendMessage,
  onCaptureAndAnalyze,
  isStreaming,
  onStopStream,
  hasApiKey,
  isListening,
  isTranscribing,
  onToggleListening,
  onWhatToAnswer,
  onRecap,
  onFollowUp,
  onShorten,
  transcriptCount,
  showTranscriptDrawer,
  onToggleTranscriptDrawer,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus input when not streaming or listening
  useEffect(() => {
    if (!isStreaming && !isListening) {
      inputRef.current?.focus();
    }
  }, [isStreaming, isListening]);

  return (
    <div className="shrink-0 p-3 pt-2 bg-gradient-to-t from-black/60 to-transparent border-t border-white/[0.06] flex flex-col gap-2">
      {/* 1. Quick Intelligent Meeting Action Strip */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 select-none" style={{ scrollbarWidth: 'none' }}>
        <button
          onClick={onWhatToAnswer}
          disabled={isStreaming}
          className="shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[11px] font-medium transition-all bg-blue-500/15 border border-blue-500/30 text-blue-300 hover:bg-blue-500/25 active:scale-95 disabled:opacity-40 shadow-xs"
          title="Analyze recent audio transcript and suggest the optimal answer [Alt+W]"
        >
          <span>🎯</span>
          <span>What to answer?</span>
          <kbd className="font-mono text-[9px] bg-blue-950/60 px-1 rounded opacity-70">Alt+W</kbd>
        </button>

        <button
          onClick={onRecap}
          disabled={isStreaming}
          className="shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[11px] font-medium transition-all bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/25 active:scale-95 disabled:opacity-40 shadow-xs"
          title="Summarize key points from meeting conversation [Alt+R]"
        >
          <span>📋</span>
          <span>Recap</span>
          <kbd className="font-mono text-[9px] bg-emerald-950/60 px-1 rounded opacity-70">Alt+R</kbd>
        </button>

        <button
          onClick={onFollowUp}
          disabled={isStreaming}
          className="shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[11px] font-medium transition-all bg-amber-500/15 border border-amber-500/30 text-amber-300 hover:bg-amber-500/25 active:scale-95 disabled:opacity-40 shadow-xs"
          title="Suggest 3 strategic follow-up questions [Alt+F]"
        >
          <span>💡</span>
          <span>Follow Up</span>
          <kbd className="font-mono text-[9px] bg-amber-950/60 px-1 rounded opacity-70">Alt+F</kbd>
        </button>

        <button
          onClick={onShorten}
          disabled={isStreaming}
          className="shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[11px] font-medium transition-all bg-purple-500/15 border border-purple-500/30 text-purple-300 hover:bg-purple-500/25 active:scale-95 disabled:opacity-40 shadow-xs"
          title="Condense previous response into spoken bullet points [Alt+K]"
        >
          <span>✂️</span>
          <span>Shorten</span>
          <kbd className="font-mono text-[9px] bg-purple-950/60 px-1 rounded opacity-70">Alt+K</kbd>
        </button>

        {transcriptCount > 0 && (
          <button
            onClick={onToggleTranscriptDrawer}
            className={`shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[11px] font-medium transition-all ml-auto ${
              showTranscriptDrawer
                ? 'bg-cyan-500/30 border border-cyan-400 text-cyan-200'
                : 'bg-white/[0.04] border border-white/[0.08] text-white/50 hover:text-white hover:bg-white/[0.08]'
            }`}
            title="Toggle Live Audio Transcripts [Alt+T]"
          >
            <ListOrdered className="w-3 h-3 text-cyan-400" />
            <span>Transcript ({transcriptCount})</span>
            <kbd className="font-mono text-[9px] bg-white/5 px-1 rounded opacity-60">Alt+T</kbd>
          </button>
        )}
      </div>

      {/* 2. Live Audio / Transcription Active State Banners */}
      {isListening && (
        <div className="flex items-center justify-between px-3.5 py-2 rounded-xl text-xs bg-red-500/15 border border-red-500/40 text-red-200 animate-pulse">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
            <span className="font-semibold text-xs">🎙️ Listening to microphone... Speak now</span>
          </div>
          <button
            onClick={onToggleListening}
            className="px-2.5 py-1 rounded-lg text-[10px] font-semibold bg-red-600/40 hover:bg-red-600/60 border border-red-400/30 text-white transition-all flex items-center gap-1"
          >
            <span>Stop & Send</span>
            <kbd className="font-mono text-[9px] bg-red-950/80 px-1 rounded">F9</kbd>
          </button>
        </div>
      )}

      {isTranscribing && (
        <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs bg-orange-500/15 border border-orange-500/30 text-orange-200">
          <Loader2 className="w-3.5 h-3.5 animate-spin text-orange-400" />
          <span className="font-medium text-xs">Transcribing voice with Whisper...</span>
        </div>
      )}

      {/* 3. Main Glassmorphic Command Input Bar */}
      <div
        className="flex items-center gap-2 rounded-2xl px-3 py-2 bg-white/[0.05] border border-white/[0.1] focus-within:border-blue-500/60 focus-within:ring-2 focus-within:ring-blue-500/20 transition-all shadow-lg"
      >
        {/* Screen Capture Shortcut Button */}
        <button
          onClick={onCaptureAndAnalyze}
          disabled={isStreaming || !hasApiKey}
          className="p-1.5 rounded-xl text-white/50 hover:text-blue-400 hover:bg-blue-500/10 active:scale-95 transition-all disabled:opacity-30"
          title="Instant Screen Vision Capture [Alt+S / Ctrl+Shift+S]"
        >
          <Camera className="w-4 h-4" />
        </button>

        {/* Input Text Box */}
        <input
          ref={inputRef}
          type="text"
          value={inputPrompt}
          onChange={(e) => setInputPrompt(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              onSendMessage();
            }
          }}
          placeholder={
            isListening
              ? 'Listening to spoken words...'
              : hasApiKey
                ? 'Ask Copilot, press F9 to speak, or Alt+S to analyze screen...'
                : 'Configure API key in Settings to get started...'
          }
          disabled={isStreaming || !hasApiKey || isListening}
          className="flex-1 bg-transparent text-xs text-white placeholder-white/35 outline-none font-sans caret-blue-400"
        />

        {/* Push-to-Listen Mic Button */}
        <button
          onClick={onToggleListening}
          disabled={isStreaming || isTranscribing}
          className={`p-1.5 rounded-xl transition-all ${
            isListening
              ? 'bg-red-500/30 text-red-300 border border-red-500/50 shadow-sm animate-pulse'
              : 'text-white/50 hover:text-emerald-400 hover:bg-emerald-500/10'
          } disabled:opacity-30`}
          title={isListening ? 'Stop listening & process (F9)' : 'Push to Talk: Voice dictation (F9 / Alt+L)'}
        >
          {isListening ? <MicOff className="w-4 h-4 text-red-400" /> : <Mic className="w-4 h-4" />}
        </button>

        {/* Stop or Send Action Button */}
        {isStreaming ? (
          <button
            onClick={onStopStream}
            className="p-1.5 rounded-xl bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 text-red-300 active:scale-95 transition-all"
            title="Stop generating response (Esc)"
          >
            <StopCircle className="w-4 h-4" />
          </button>
        ) : (
          <button
            onClick={onSendMessage}
            disabled={!inputPrompt.trim() || !hasApiKey}
            className={`p-1.5 rounded-xl transition-all ${
              inputPrompt.trim() && hasApiKey
                ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-md active:scale-95'
                : 'bg-white/[0.04] text-white/20 cursor-not-allowed'
            }`}
            title="Send query (Enter)"
          >
            <Send className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
};
