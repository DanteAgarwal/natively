import React, { useState } from 'react';
import { Copy, Check, Loader2 } from 'lucide-react';
import { Message } from '../types/config';
import { MarkdownRenderer } from './MarkdownRenderer';

interface MessageBubbleProps {
  msg: Message;
  provider?: 'gemini' | 'groq' | 'openrouter' | 'router';
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({ msg, provider = 'gemini' }) => {
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
    <div className="flex flex-col items-start">
      <div
        className="relative group text-xs w-full max-w-full rounded-2xl rounded-tl-sm px-3.5 py-2.5"
        style={{
          background: msg.isError ? 'rgba(239,68,68,0.07)' : 'rgba(255,255,255,0.03)',
          border: `1px solid ${msg.isError ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.07)'}`,
          color: 'rgba(255,255,255,0.85)',
        }}
      >
        {msg.text ? (
          <>
            <MarkdownRenderer content={msg.text} />
            <div
              className="mt-2 pt-1.5 flex justify-end opacity-0 group-hover:opacity-100 transition-opacity"
              style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}
            >
              <button
                onClick={handleCopy}
                className="flex items-center gap-1 text-[10px] transition-colors"
                style={{ color: 'rgba(255,255,255,0.3)' }}
              >
                {copied ? <Check className="w-3 h-3" style={{ color: '#34d399' }} /> : <Copy className="w-3 h-3" />}
                <span>{copied ? 'Copied!' : 'Copy'}</span>
              </button>
            </div>
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
