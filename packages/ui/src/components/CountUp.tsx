import { useEffect, useRef, useState } from 'react';

const motionDisabled = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
  document.querySelector('.disable-animations') !== null;

// Animated integer: eases from the previous value (0 on mount) to `value`.
export default function CountUp({ value, duration = 650, className = '', suffix = '' }:
  { value: number; duration?: number; className?: string; suffix?: string }) {
  const [shown, setShown] = useState(0);
  const prev = useRef(0);

  useEffect(() => {
    const from = prev.current;
    prev.current = value;
    if (from === value || motionDisabled()) { setShown(value); return; }
    const t0 = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setShown(Math.round(from + (value - from) * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);

  return <span className={className}>{shown}{suffix}</span>;
}
