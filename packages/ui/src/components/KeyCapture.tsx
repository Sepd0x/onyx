import { useEffect, useRef, useState } from 'react';
import { Keyboard, RotateCcw } from 'lucide-react';

// Records a global-shortcut accelerator in Electron's format (e.g.
// "CommandOrControl+Alt+D"). Click to record, then press the combo. A modifier is
// required (global shortcuts without one are rejected by the OS / too grabby).
// Pure presentation — the parent owns the value and persistence.

const NAMED: Record<string, string> = {
  ' ': 'Space', ArrowUp: 'Up', ArrowDown: 'Down', ArrowLeft: 'Left', ArrowRight: 'Right',
  Escape: 'Esc', Enter: 'Enter', Tab: 'Tab', Backspace: 'Backspace', Delete: 'Delete',
  '+': 'Plus', '=': 'Plus',
};

// Build an Electron accelerator from a keydown event, or null if it isn't a valid
// combo yet (pure modifier press, or no modifier held).
export function toAccelerator(e: KeyboardEvent): string | null {
  const mods: string[] = [];
  if (e.ctrlKey) mods.push('CommandOrControl');
  if (e.altKey) mods.push('Alt');
  if (e.shiftKey) mods.push('Shift');
  if (e.metaKey) mods.push('Super');
  const k = e.key;
  if (['Control', 'Alt', 'Shift', 'Meta', 'OS'].includes(k)) return null; // waiting for the real key
  if (!mods.length) return null; // require at least one modifier
  // NAMED first so single-char specials (space, +, =) map correctly before the
  // generic single-char uppercase; multi-char keys (F5, Home, …) pass through.
  const key = NAMED[k] || (k.length === 1 ? k.toUpperCase() : k);
  return [...mods, key].join('+');
}

// Human-friendly chips from an accelerator string.
function prettyParts(accel: string): string[] {
  return (accel || '').split('+').map((p) => (p === 'CommandOrControl' ? 'Ctrl' : p === 'Super' ? 'Win' : p));
}

export default function KeyCapture({ value, onChange, onReset }: { value: string; onChange: (accel: string) => void; onReset?: () => void }) {
  const [recording, setRecording] = useState(false);
  const boxRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!recording) return;
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.key === 'Escape') { setRecording(false); return; }
      const accel = toAccelerator(e);
      if (accel) { onChange(accel); setRecording(false); }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [recording, onChange]);

  return (
    <div className="flex items-center gap-2">
      <button
        ref={boxRef}
        onClick={() => setRecording((r) => !r)}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-[11px] font-mono transition-colors min-w-[150px] justify-center ${
          recording ? 'border-primary/50 bg-primary/10 text-accent animate-pulse' : 'border-border bg-surface2 text-text2 hover:bg-surface3'
        }`}
      >
        <Keyboard className="w-3.5 h-3.5 shrink-0" />
        {recording ? (
          'Press a combo…'
        ) : (
          <span className="flex items-center gap-1">
            {prettyParts(value).map((p, i) => (
              <kbd key={i} className="bg-background border border-border rounded px-1.5 py-0.5 text-[10px] text-text">{p}</kbd>
            ))}
          </span>
        )}
      </button>
      {onReset && !recording && (
        <button onClick={onReset} title="Reset to default" className="p-1.5 rounded-md text-muted hover:text-text hover:bg-surface2 transition-colors">
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}
