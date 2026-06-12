import type { ComponentType, ReactNode } from 'react';

// Shared first-run / no-data state: explains what the view is for and
// offers an action, instead of a dead-end label.
export default function EmptyState({ icon: Icon, title, description, children, compact = false }:
  { icon: ComponentType<{ className?: string }>; title: string; description: string; children?: ReactNode; compact?: boolean }) {
  return (
    <div className={`flex flex-col items-center justify-center text-center rounded-xl border border-dashed border-border bg-surface/30 animate-in fade-in zoom-in-95 ${compact ? 'py-8 px-4' : 'py-14 px-6'}`}>
      <div className="p-3.5 rounded-2xl bg-surface2 border border-border mb-4 text-primary shadow-[0_0_20px_rgb(var(--primary)/0.12)]">
        <Icon className={compact ? 'w-5 h-5' : 'w-6 h-6'} />
      </div>
      <h3 className="text-[14px] font-bold text-text mb-1.5">{title}</h3>
      <p className="text-[11px] text-muted leading-relaxed max-w-sm">{description}</p>
      {children && <div className="mt-5 flex items-center gap-3">{children}</div>}
    </div>
  );
}
