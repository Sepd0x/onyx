// User-pickable accent colours. The whole UI keys off --primary / --accent
// (RGB triplets, no alpha), so overriding those two CSS vars on <html> recolours
// every accent in the app at once — the "1 accent" system made personal.
export interface Accent {
  key: string;
  label: string;
  primary: string; // "r g b"
  accent: string; // "r g b"
  swatch: string; // hex, for the picker dot
}

export const ACCENTS: Accent[] = [
  { key: 'purple', label: 'Purple', primary: '139 92 246', accent: '192 132 252', swatch: '#8b5cf6' },
  { key: 'blue', label: 'Blue', primary: '59 130 246', accent: '96 165 250', swatch: '#3b82f6' },
  { key: 'teal', label: 'Teal', primary: '20 184 166', accent: '45 212 191', swatch: '#14b8a6' },
  { key: 'emerald', label: 'Emerald', primary: '16 185 129', accent: '52 211 153', swatch: '#10b981' },
  { key: 'amber', label: 'Amber', primary: '234 160 30', accent: '251 191 36', swatch: '#f59e0b' },
  { key: 'rose', label: 'Rose', primary: '244 63 94', accent: '251 113 133', swatch: '#f43f5e' },
];

export const DEFAULT_ACCENT = 'purple';

// Applies an accent by overriding the CSS vars; an unknown/empty key clears the
// override so the active theme's own --primary/--accent take back over.
export function applyAccent(key?: string): void {
  const root = document.documentElement;
  const a = ACCENTS.find((x) => x.key === key);
  if (!a) {
    root.style.removeProperty('--primary');
    root.style.removeProperty('--accent');
    return;
  }
  root.style.setProperty('--primary', a.primary);
  root.style.setProperty('--accent', a.accent);
}
