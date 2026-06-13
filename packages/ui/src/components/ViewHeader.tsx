import type { ComponentType, ReactNode } from 'react';

type Accent = 'primary' | 'success' | 'warning' | 'danger' | 'info';

const TINT: Record<Accent, string> = {
  primary: 'text-primary',
  success: 'text-success',
  warning: 'text-warning',
  danger: 'text-danger',
  info: 'text-info',
};

// The one premium header every view uses: a glowing gradient icon tile, a
// bold title with an optional badge, the caps-mono micro-label subtitle, and
// an optional right-side actions slot. Replaces ~10 hand-rolled headers that
// disagreed on size, weight and subtitle styling.
export default function ViewHeader({
  icon: Icon,
  title,
  subtitle,
  badge,
  actions,
  accent = 'primary',
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
        <div
          className="icon-tile"
          style={{ boxShadow: `inset 0 1px 0 rgb(var(--text2) / 0.06), 0 0 24px -6px rgb(var(--${accent}) / 0.45)` }}
        >
          <Icon className={`w-6 h-6 ${TINT[accent]}`} />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-text tracking-tight flex items-center gap-3">
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
