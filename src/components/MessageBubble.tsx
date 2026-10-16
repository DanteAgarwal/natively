import React, { useState } from 'react';
import { Copy, Check, Loader2, RotateCw, Settings, AlertTriangle } from 'lucide-react';
import { Message } from '../types/config';
import { MarkdownRenderer } from './MarkdownRenderer';

interface MessageBubbleProps {
  msg: Message;
  provider?: 'gemini' | 'groq' | 'openrouter' | 'router';
  onRetry?: () => void;
  onOpenSettings?: () => void;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({
  msg,
  provider = 'gemini',
  onRetry,
  onOpenSettings,
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(msg.text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (msg.role === 'user') {
    return (
      <div className="flex flex-col items-end gap-1.5">
        {msg.screenshotPreview && (
          <div
            className="rounded-lg overflow-hidden max-w-[180px]"
            style={{ border: '1px solid rgba(255,255,255,0.08)' }}
          >
            <img src={msg.screenshotPreview} alt="Screen capture" className="w-full h-auto object-cover max-h-28" />
          </div>
        )}
        <div
          className="px-3 py-1.5 rounded-2xl rounded-tr-sm text-xs max-w-[85%] break-words"
          style={{
            background: 'rgba(37,99,235,0.2)',
            border: '1px solid rgba(59,130,246,0.25)',
            color: '#bfdbfe',
          }}
        >
          {msg.text}
        </div>
      </div>
    );
  }

  // Model response message
  return (
    <div className="flex flex-col items-start w-full">
      <div
        className="relative group text-xs w-full max-w-full rounded-2xl rounded-tl-sm px-3.5 py-2.5 transition-all"
        style={{
          background: msg.isError ? 'rgba(239,68,68,0.09)' : 'rgba(255,255,255,0.03)',
          border: `1px solid ${msg.isError ? 'rgba(239,68,68,0.35)' : 'rgba(255,255,255,0.07)'}`,
          color: msg.isError ? '#fca5a5' : 'rgba(255,255,255,0.85)',
          boxShadow: msg.isError ? '0 4px 20px rgba(239,68,68,0.1)' : undefined,
        }}
      >
        {msg.text ? (
          <>
            <div className="flex items-start gap-1.5">
              {msg.isError && <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />}
              <div className="flex-1 min-w-0">
                <MarkdownRenderer content={msg.text} />
              </div>
            </div>

            {msg.isError && (
              <div
                className="mt-2.5 pt-2 flex items-center gap-2"
                style={{ borderTop: '1px solid rgba(239,68,68,0.2)' }}
              >
                {onRetry && (
                  <button
                    onClick={onRetry}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-semibold bg-red-500/20 hover:bg-red-500/30 text-red-200 border border-red-500/40 transition-colors shadow-xs"
                    title="Retry this prompt"
                  >
                    <RotateCw className="w-3 h-3" />
                    <span>Retry</span>
                  </button>
                )}
                {onOpenSettings && (
                  <button
                    onClick={onOpenSettings}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-semibold bg-white/5 hover:bg-white/10 text-white/80 border border-white/10 transition-colors"
                    title="Open settings to verify API key & endpoint"
                  >
                    <Settings className="w-3 h-3" />
                    <span>Check Settings</span>
                  </button>
                )}
              </div>
            )}

            {!msg.isError && (
              <div
                className="mt-2 pt-1.5 flex justify-end opacity-0 group-hover:opacity-100 transition-opacity"
                style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}
              >
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-1 text-[10px] transition-colors hover:text-white"
                  style={{ color: 'rgba(255,255,255,0.4)' }}
                >
                  {copied ? <Check className="w-3 h-3" style={{ color: '#34d399' }} /> : <Copy className="w-3 h-3" />}
                  <span>{copied ? 'Copied!' : 'Copy'}</span>
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="flex items-center gap-2 py-1" style={{ color: 'rgba(255,255,255,0.4)' }}>
            <Loader2 className="w-3.5 h-3.5 animate-spin" style={{ color: '#3b82f6' }} />
            <span className="text-[11px] font-mono">
              {provider === 'groq'
                ? 'Groq is thinking...'
                : provider === 'openrouter'
                  ? 'OpenRouter is thinking...'
                  : provider === 'router'
                    ? 'Free Router is thinking...'
                    : 'Gemini is analyzing...'}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export default MessageBubble;
