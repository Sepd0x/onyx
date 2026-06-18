// Pure window-state helpers (no electron) so restore/clamp logic is unit-testable
// apart from the disk + BrowserWindow plumbing in index.js.
//
// Why clamp: a window saved on a second monitor that's since been unplugged would
// otherwise open off-screen (invisible, "the app didn't launch"). We only restore
// saved bounds if their title-bar area still overlaps a connected display's work
// area; otherwise we fall back to a centered default on the primary display.

// Validate a bounds object into finite integers, or null if unusable.
function sanitizeBounds(b) {
  if (!b || typeof b !== 'object') return null;
  const n = (v) => (Number.isFinite(v) ? Math.round(v) : null);
  const x = n(b.x), y = n(b.y), width = n(b.width), height = n(b.height);
  if (x === null || y === null || width === null || height === null) return null;
  if (width < 1 || height < 1) return null;
  return { x, y, width, height };
}

// Does the window's top edge / a chunk of its title bar fall inside any display's
// work area? Uses a small visible-margin so a 1px sliver doesn't count as "visible".
function isVisibleOnAny(bounds, displays, margin = 48) {
  const b = sanitizeBounds(bounds);
  if (!b || !Array.isArray(displays)) return false;
  return displays.some((d) => {
    const wa = (d && d.workArea) || d;
    if (!wa) return false;
    const overlapX = Math.min(b.x + b.width, wa.x + wa.width) - Math.max(b.x, wa.x);
    const overlapY = Math.min(b.y + b.height, wa.y + wa.height) - Math.max(b.y, wa.y);
    return overlapX >= margin && overlapY >= margin;
  });
}

// Center a width×height window on a display's work area.
function centerOn(workArea, width, height) {
  return {
    x: Math.round(workArea.x + (workArea.width - width) / 2),
    y: Math.round(workArea.y + (workArea.height - height) / 2),
    width,
    height,
  };
}

// Resolve the bounds to actually open with. `saved` is what we persisted last time;
// `displays` is screen.getAllDisplays(); `defaults` is {width,height}. Returns
// { x, y, width, height }.
function restoreBounds(saved, displays, defaults) {
  const def = { width: (defaults && defaults.width) || 980, height: (defaults && defaults.height) || 680 };
  const primary = (Array.isArray(displays) && displays[0]) || null;
  const wa = (primary && (primary.workArea || primary)) || { x: 0, y: 0, width: 1920, height: 1080 };
  const b = sanitizeBounds(saved);
  if (b && isVisibleOnAny(b, displays)) return b;
  return centerOn(wa, def.width, def.height);
}

module.exports = { sanitizeBounds, isVisibleOnAny, centerOn, restoreBounds };
