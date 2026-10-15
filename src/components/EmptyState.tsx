import React from 'react';
import { Sparkles, Settings, Camera } from 'lucide-react';

interface EmptyStateProps {
  onCapture: () => void;
  onOpenSettings: () => void;
  hasApiKey: boolean;
  provider: 'gemini' | 'groq' | 'openrouter' | 'router';
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  onCapture,
  onOpenSettings,
  hasApiKey,
  provider,
}) => (
  <div className="h-full flex flex-col items-center justify-center text-center p-6 py-8">
    <div
      className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
      style={{
        background: 'linear-gradient(135deg, rgba(59,130,246,0.2), rgba(99,102,241,0.1))',
        border: '1px solid rgba(59,130,246,0.2)',
        boxShadow: '0 8px 32px rgba(59,130,246,0.15)',
      }}
    >
      <Sparkles className="w-7 h-7" style={{ color: '#60a5fa' }} />
    </div>
    <h3 className="text-sm font-semibold mb-1.5" style={{ color: 'white' }}>Ghost AI Ready</h3>
    <p className="text-xs mb-5 leading-relaxed max-w-[260px]" style={{ color: 'rgba(255,255,255,0.4)' }}>
      {hasApiKey
        ? 'Completely invisible on screen share. Ask anything or capture your screen for instant AI analysis.'
        : provider === 'openrouter'
          ? 'Add your OpenRouter key to get started with free models (:free). This overlay is invisible in all screen share apps.'
          : provider === 'groq'
            ? 'Add your Groq API key to get started. This overlay is invisible in all screen share apps.'
            : provider === 'router'
              ? 'Configure your Free Router endpoint in Settings to get started. This overlay is invisible in all screen share apps.'
              : 'Add your free Gemini API key to get started. This overlay is invisible in all screen share apps.'}
    </p>
    {!hasApiKey ? (
      <button
        onClick={onOpenSettings}
        className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all"
        style={{ background: '#2563eb', color: 'white' }}
      >
        <Settings className="w-3.5 h-3.5" />
        {provider === 'openrouter'
          ? 'Add OpenRouter Key'
          : provider === 'groq'
            ? 'Add Groq API Key'
            : provider === 'router'
              ? 'Configure Free Router'
              : 'Add Gemini API Key'}
      </button>
    ) : (
      <div className="flex flex-col gap-2 items-center">
        <button
          onClick={onCapture}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all"
          style={{ background: '#2563eb', color: 'white' }}
        >
          <Camera className="w-3.5 h-3.5" />
          Capture & Analyze Screen
        </button>
        <div className="flex flex-col gap-1 text-[11px] mt-2" style={{ color: 'rgba(255,255,255,0.3)' }}>
          <div>
            <kbd className="px-1.5 py-0.5 rounded text-[10px] font-mono mr-1.5" style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)' }}>Ctrl+\</kbd>
            Toggle visibility
          </div>
          <div>
            <kbd className="px-1.5 py-0.5 rounded text-[10px] font-mono mr-1.5" style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)' }}>Ctrl+Shift+S</kbd>
            Instant screen capture
          </div>
          <div>
            <kbd className="px-1.5 py-0.5 rounded text-[10px] font-mono mr-1.5" style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)' }}>F9 / Ctrl+Shift+L</kbd>
            Push to Listen (Speaker voice)
          </div>
        </div>
      </div>
    )}
  </div>
);

export default EmptyState;
