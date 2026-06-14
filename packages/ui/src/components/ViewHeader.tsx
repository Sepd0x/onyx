import type { ComponentType, ReactNode } from 'react';

// Kept for back-compat with existing call sites; the header now uses one
// unified accent regardless, so the value is intentionally ignored.
type Accent = 'primary' | 'success' | 'warning' | 'danger' | 'info';

// The one header every view uses: a flat neutral icon tile with the brand
// accent icon, a title with an optional badge, the caps-mono micro-label
// subtitle, and an optional right-side actions slot. One accent, no per-view
// colour — replaces ~10 hand-rolled headers that disagreed on size and tint.
export default function ViewHeader({
  icon: Icon,
  title,
  subtitle,
  badge,
  actions,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  subtitle: string;
  badge?: ReactNode;
  actions?: ReactNode;
  accent?: Accent;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div className="flex items-center gap-4">
        <div className="icon-tile">
          <Icon className="w-6 h-6 text-accent" />
        </div>
        <div>
          <h2 className="text-2xl font-semibold text-text tracking-tight flex items-center gap-3">
            {title}
            {badge}
          </h2>
          <p className="micro-label mt-1.5">{subtitle}</p>
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
