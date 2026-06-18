import { describe, it, expect } from 'vitest';
import { sanitizeBounds, isVisibleOnAny, centerOn, restoreBounds } from './state.js';

const display = (x, y, w, h) => ({ workArea: { x, y, width: w, height: h } });
const primary = display(0, 0, 1920, 1080);

describe('sanitizeBounds', () => {
  it('rounds finite numbers', () => {
    expect(sanitizeBounds({ x: 10.4, y: 20.6, width: 800.2, height: 600.9 })).toEqual({ x: 10, y: 21, width: 800, height: 601 });
  });
  it('rejects non-finite or non-positive sizes', () => {
    expect(sanitizeBounds({ x: 0, y: 0, width: 0, height: 100 })).toBeNull();
    expect(sanitizeBounds({ x: NaN, y: 0, width: 100, height: 100 })).toBeNull();
    expect(sanitizeBounds(null)).toBeNull();
  });
});

describe('isVisibleOnAny', () => {
  it('is true when the window sits inside a display', () => {
    expect(isVisibleOnAny({ x: 100, y: 100, width: 800, height: 600 }, [primary])).toBe(true);
  });
  it('is false when the window is fully off all displays (unplugged monitor)', () => {
    expect(isVisibleOnAny({ x: 3000, y: 100, width: 800, height: 600 }, [primary])).toBe(false);
  });
  it('counts a second monitor', () => {
    const second = display(1920, 0, 1920, 1080);
    expect(isVisibleOnAny({ x: 2000, y: 100, width: 800, height: 600 }, [primary, second])).toBe(true);
  });
});

describe('centerOn', () => {
  it('centers within the work area', () => {
    expect(centerOn({ x: 0, y: 0, width: 1000, height: 800 }, 200, 100)).toEqual({ x: 400, y: 350, width: 200, height: 100 });
  });
});

describe('restoreBounds', () => {
  it('returns saved bounds when still visible', () => {
    const saved = { x: 50, y: 60, width: 1000, height: 700 };
    expect(restoreBounds(saved, [primary], { width: 980, height: 680 })).toEqual(saved);
  });
  it('falls back to centered default when saved is off-screen', () => {
    const r = restoreBounds({ x: 5000, y: 5000, width: 800, height: 600 }, [primary], { width: 980, height: 680 });
    expect(r.width).toBe(980);
    expect(r.height).toBe(680);
    expect(r.x).toBe(Math.round((1920 - 980) / 2));
  });
  it('uses default centered bounds when nothing was saved', () => {
    const r = restoreBounds(null, [primary], { width: 980, height: 680 });
    expect(r).toEqual({ x: 470, y: 200, width: 980, height: 680 });
  });
});
