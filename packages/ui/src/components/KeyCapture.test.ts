import { describe, it, expect } from 'vitest';
import { toAccelerator } from './KeyCapture';

// toAccelerator only reads ctrlKey/altKey/shiftKey/metaKey/key, so a plain object
// stands in for a KeyboardEvent.
const ev = (o: Partial<Record<string, any>>) => o as unknown as KeyboardEvent;

describe('toAccelerator', () => {
  it('builds an Electron accelerator from modifiers + a letter', () => {
    expect(toAccelerator(ev({ ctrlKey: true, altKey: true, key: 'd' }))).toBe('CommandOrControl+Alt+D');
    expect(toAccelerator(ev({ ctrlKey: true, shiftKey: true, key: 'P' }))).toBe('CommandOrControl+Shift+P');
  });
  it('maps meta to Super and keeps order ctrl/alt/shift/super', () => {
    expect(toAccelerator(ev({ ctrlKey: true, altKey: true, shiftKey: true, metaKey: true, key: 'k' })))
      .toBe('CommandOrControl+Alt+Shift+Super+K');
  });
  it('requires a modifier (a bare key is not a valid global shortcut)', () => {
    expect(toAccelerator(ev({ key: 'A' }))).toBeNull();
  });
  it('returns null while only a modifier is held (waiting for the real key)', () => {
    expect(toAccelerator(ev({ ctrlKey: true, key: 'Control' }))).toBeNull();
    expect(toAccelerator(ev({ shiftKey: true, key: 'Shift' }))).toBeNull();
  });
  it('names special keys', () => {
    expect(toAccelerator(ev({ ctrlKey: true, key: ' ' }))).toBe('CommandOrControl+Space');
    expect(toAccelerator(ev({ altKey: true, key: 'ArrowUp' }))).toBe('Alt+Up');
    expect(toAccelerator(ev({ ctrlKey: true, key: 'F5' }))).toBe('CommandOrControl+F5');
  });
});
