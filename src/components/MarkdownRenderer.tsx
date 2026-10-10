import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Copy, Check } from 'lucide-react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';

interface MarkdownRendererProps {
  content: string;
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content }) => {
  return (
    <div className="prose prose-invert prose-sm max-w-none text-neutral-200 text-xs leading-relaxed break-words space-y-2">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code({ node, inline, className, children, ...props }: any) {
            const match = /language-(\w+)/.exec(className || '');
            const codeString = String(children).replace(/\n$/, '');

            if (!inline && match) {
              return <CodeBlock language={match[1]} code={codeString} />;
            }

            if (!inline && codeString.includes('\n')) {
              return <CodeBlock language="text" code={codeString} />;
            }

            return (
              <code
                className="bg-neutral-800/80 text-emerald-400 px-1.5 py-0.5 rounded text-[11px] font-mono border border-neutral-700/50"
                {...props}
              >
                {children}
              </code>
            );
          },
          p({ children }) {
            return <p className="mb-2 last:mb-0">{children}</p>;
          },
          ul({ children }) {
            return <ul className="list-disc pl-4 space-y-1 mb-2">{children}</ul>;
          },
          ol({ children }) {
            return <ol className="list-decimal pl-4 space-y-1 mb-2">{children}</ol>;
          },
          table({ children }) {
            return (
              <div className="overflow-x-auto my-2 border border-neutral-800 rounded-lg">
                <table className="w-full text-left text-xs border-collapse">{children}</table>
              </div>
            );
          },
          th({ children }) {
            return <th className="bg-neutral-800/60 p-2 font-semibold text-neutral-300 border-b border-neutral-700">{children}</th>;
          },
          td({ children }) {
            return <td className="p-2 border-b border-neutral-800 text-neutral-300">{children}</td>;
          },
          a({ href, children }) {
            return (
              <a href={href} target="_blank" rel="noreferrer" className="text-blue-400 hover:underline">
                {children}
              </a>
            );
          }
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};

interface CodeBlockProps {
  language: string;
  code: string;
}

const CodeBlock: React.FC<CodeBlockProps> = ({ language, code }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative my-3 rounded-lg overflow-hidden border border-neutral-800 bg-[#141417]">
      <div className="flex items-center justify-between px-3 py-1.5 bg-neutral-900/80 border-b border-neutral-800/60 text-[10px] text-neutral-400 font-mono">
        <span className="uppercase tracking-wider">{language || 'code'}</span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 hover:text-white transition-colors bg-neutral-800/60 hover:bg-neutral-700/60 px-2 py-0.5 rounded text-[10px]"
        >
          {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
          <span>{copied ? 'Copied' : 'Copy'}</span>
        </button>
      </div>
      <div className="text-[11px] font-mono overflow-x-auto p-2.5">
        <SyntaxHighlighter
          language={language || 'text'}
          style={oneDark}
          customStyle={{
            margin: 0,
            padding: 0,
            background: 'transparent',
            fontSize: '11px',
            lineHeight: '1.4'
          }}
          wrapLines={true}
        >
          {code}
        </SyntaxHighlighter>
      </div>
    </div>
  );
};
