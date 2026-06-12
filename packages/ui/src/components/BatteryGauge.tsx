import { Zap } from 'lucide-react';
import CountUp from './CountUp';

// Radial battery gauge: status-toned arc with glow, animated sweep + count-up.
export default function BatteryGauge({ level, charging, size = 132 }:
  { level: number; charging: boolean; size?: number }) {
  const r = 54;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, level));
  const dash = (pct / 100) * c;
  const tone =
    pct <= 20 && !charging ? 'rgb(var(--danger))'
    : pct <= 45 && !charging ? 'rgb(var(--warning))'
    : 'rgb(var(--success))';

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg viewBox="0 0 132 132" className="w-full h-full -rotate-90">
        <circle cx="66" cy="66" r={r} fill="none" stroke="rgb(var(--surface3))" strokeWidth="10" />
        <circle
          cx="66" cy="66" r={r} fill="none"
          stroke={tone} strokeWidth="10" strokeLinecap="round"
          strokeDasharray={`${dash} ${c - dash}`}
          style={{
            filter: `drop-shadow(0 0 6px ${tone.replace(')', ' / 0.55)')})`,
            transition: 'stroke-dasharray 700ms cubic-bezier(0.22,1,0.36,1), stroke 300ms',
          }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="text-3xl font-bold text-text leading-none">
          <CountUp value={pct} /><span className="text-base text-muted">%</span>
        </div>
        <div className={`mt-1.5 flex items-center gap-1 text-[9px] font-mono uppercase tracking-widest ${charging ? 'text-success' : 'text-muted'}`}>
          {charging && <Zap className="w-3 h-3" />} {charging ? 'Charging' : 'On battery'}
        </div>
      </div>
    </div>
  );
}
