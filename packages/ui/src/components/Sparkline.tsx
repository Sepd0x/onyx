// Shared activity sparkline: gradient bars, glowing "today", hover tooltip.
export default function Sparkline({ data, className = '' }: { data: number[]; className?: string }) {
  if (!data || data.length < 2) return null;
  const max = Math.max(...data, 1);
  return (
    <div className={`flex items-end gap-[3px] h-8 flex-1 ${className}`}>
      {data.map((v, i) => {
        const h = Math.max(10, Math.round((v / max) * 100));
        const isToday = i === data.length - 1;
        const daysAgo = data.length - 1 - i;
        const label = `${v} commit${v === 1 ? '' : 's'} · ${daysAgo === 0 ? 'today' : daysAgo === 1 ? 'yesterday' : `${daysAgo}d ago`}`;
        return (
          <div key={i} className="relative flex-1 h-full flex items-end group/spark">
            <div
              className={`w-full rounded-sm transition-all duration-300 ${
                isToday
                  ? 'bg-gradient-to-t from-primary to-accent shadow-[0_0_8px_rgb(var(--primary)/0.5)]'
                  : v > 0
                    ? 'bg-gradient-to-t from-primary/40 to-primary/15 group-hover/spark:from-primary/70 group-hover/spark:to-primary/40'
                    : 'bg-surface3 group-hover/spark:bg-border2'
              }`}
              style={{ height: `${h}%` }}
            />
            <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 rounded-md bg-surface3 border border-border2 text-[9px] font-mono text-text whitespace-nowrap opacity-0 group-hover/spark:opacity-100 transition-opacity duration-150 z-20 shadow-lg">
              {label}
            </div>
          </div>
        );
      })}
    </div>
  );
}
