import { Fragment, type ReactNode } from 'react';
import { parseBlocks, type Block, type Inline } from '../lib/markdown';

// Renders the parsed Markdown model (lib/markdown.ts) to themed React nodes.
// No `dangerouslySetInnerHTML` — every node is a real element, so untrusted model
// text can't inject HTML. Links are shown styled but NOT clickable: AI output is
// display-only and must never drive navigation (security model).
function renderInline(nodes: Inline[], keyPrefix: string): ReactNode[] {
  return nodes.map((n, i) => {
    const key = `${keyPrefix}-${i}`;
    switch (n.t) {
      case 'text':
        return <Fragment key={key}>{n.v}</Fragment>;
      case 'bold':
        return <strong key={key} className="font-semibold text-text">{renderInline(n.v, key)}</strong>;
      case 'italic':
        return <em key={key} className="italic">{renderInline(n.v, key)}</em>;
      case 'code':
        return <code key={key} className="font-mono text-[0.9em] text-accent bg-surface2 border border-border rounded px-1 py-0.5">{n.v}</code>;
      case 'link':
        // Non-clickable on purpose; the destination shows on hover.
        return <span key={key} className="text-accent underline decoration-dotted underline-offset-2" title={n.href}>{n.v}</span>;
    }
  });
}

function renderBlock(b: Block, key: string): ReactNode {
  switch (b.t) {
    case 'heading': {
      const size = b.level <= 1 ? 'text-[15px]' : b.level === 2 ? 'text-[13px]' : 'text-[12px]';
      return <div key={key} className={`${size} font-semibold text-text mt-3 first:mt-0`}>{renderInline(b.children, key)}</div>;
    }
    case 'p':
      return <p key={key} className="text-text/90 leading-relaxed">{renderInline(b.children, key)}</p>;
    case 'ul':
      return (
        <ul key={key} className="flex flex-col gap-1">
          {b.items.map((it, i) => (
            <li key={i} className="flex gap-2">
              <span className="text-accent shrink-0 leading-relaxed" aria-hidden>•</span>
              <span className="text-text/90 leading-relaxed min-w-0">{renderInline(it, `${key}-${i}`)}</span>
            </li>
          ))}
        </ul>
      );
    case 'ol':
      return (
        <ol key={key} className="flex flex-col gap-1">
          {b.items.map((it, i) => (
            <li key={i} className="flex gap-2">
              <span className="text-accent shrink-0 font-mono text-[11px] leading-relaxed tabular-nums" aria-hidden>{b.start + i}.</span>
              <span className="text-text/90 leading-relaxed min-w-0">{renderInline(it, `${key}-${i}`)}</span>
            </li>
          ))}
        </ol>
      );
    case 'code':
      return (
        <pre key={key} className="bg-background border border-border rounded-lg p-3 overflow-x-auto custom-scrollbar">
          {b.lang && <div className="micro-label mb-1.5">{b.lang}</div>}
          <code className="font-mono text-[11px] text-text/90 whitespace-pre">{b.code}</code>
        </pre>
      );
    case 'quote':
      return <blockquote key={key} className="border-l-2 border-primary/40 pl-3 text-muted italic leading-relaxed">{renderInline(b.children, key)}</blockquote>;
    case 'hr':
      return <hr key={key} className="border-border" />;
  }
}

export default function Markdown({ source, className = '' }: { source: string; className?: string }) {
  const blocks = parseBlocks(source);
  return <div className={`flex flex-col gap-2 text-[12px] ${className}`}>{blocks.map((b, i) => renderBlock(b, `b${i}`))}</div>;
}
