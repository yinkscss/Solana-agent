'use client';

import { ArrowRight, Droplets, ExternalLink } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

interface ChatMarkdownProps {
  content: string;
}

export function ChatMarkdown({ content }: ChatMarkdownProps) {
  return (
    <ReactMarkdown
      components={{
        p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
        a: ({ href, children }) => {
          // Detect faucet URLs
          if (href?.includes('faucet.solana.com')) {
            return (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 my-2 rounded-xl border border-violet-500/30 bg-violet-500/5 px-4 py-3 no-underline transition-all hover:bg-violet-500/10 hover:border-violet-500/50 group"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-violet-500/10 shrink-0">
                  <Droplets className="h-4 w-4 text-violet-400" />
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-medium text-foreground group-hover:text-violet-400 transition-colors">
                    Get Free Test SOL
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    Opens Solana faucet in a new tab
                  </span>
                </span>
                <ExternalLink className="h-4 w-4 text-muted-foreground shrink-0" />
              </a>
            );
          }

          // Detect Solana Explorer links
          if (href?.includes('explorer.solana.com')) {
            return (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 my-2 rounded-xl border border-emerald-500/30 bg-emerald-500/5 px-4 py-3 no-underline transition-all hover:bg-emerald-500/10 hover:border-emerald-500/50 group"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/10 shrink-0">
                  <ExternalLink className="h-4 w-4 text-emerald-400" />
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-medium text-foreground group-hover:text-emerald-400 transition-colors">
                    View on Explorer
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    See transaction on Solana Explorer
                  </span>
                </span>
                <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
              </a>
            );
          }

          // Normal links
          return (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-violet-400 underline underline-offset-2 hover:text-violet-300 transition-colors"
            >
              {children}
            </a>
          );
        },
        strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
        code: ({ children, className }) => {
          const isBlock = className?.includes('language-');
          if (isBlock) {
            return (
              <code className="block my-2 rounded-lg bg-secondary/50 px-3 py-2 text-xs font-mono overflow-x-auto">
                {children}
              </code>
            );
          }
          return (
            <code className="rounded bg-secondary/50 px-1.5 py-0.5 text-xs font-mono">
              {children}
            </code>
          );
        },
        ul: ({ children }) => (
          <ul className="mb-2 ml-4 list-disc space-y-1 last:mb-0">{children}</ul>
        ),
        ol: ({ children }) => (
          <ol className="mb-2 ml-4 list-decimal space-y-1 last:mb-0">{children}</ol>
        ),
        li: ({ children }) => <li>{children}</li>,
      }}
    >
      {content}
    </ReactMarkdown>
  );
}
