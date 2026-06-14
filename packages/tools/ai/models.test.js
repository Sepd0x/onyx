import { describe, it, expect } from 'vitest';
import { shouldDisableThinking } from './models.js';

describe('shouldDisableThinking', () => {
  it('is true for Gemini 2.5 / 3.x flash models (which think by default)', () => {
    expect(shouldDisableThinking('gemini-2.5-flash')).toBe(true);
    expect(shouldDisableThinking('gemini-2.5-flash-lite')).toBe(true);
    expect(shouldDisableThinking('gemini-3-flash')).toBe(true);
    expect(shouldDisableThinking('gemini-3.5-flash')).toBe(true);
  });

  it('is false for non-thinking / unsupported models', () => {
    expect(shouldDisableThinking('gemini-2.0-flash')).toBe(false); // no thinking
    expect(shouldDisableThinking('gemini-1.5-flash')).toBe(false);
    expect(shouldDisableThinking('gemini-2.5-pro')).toBe(false);   // pro can't disable
    expect(shouldDisableThinking('gpt-4o-mini')).toBe(false);
    expect(shouldDisableThinking('claude-haiku-4-5')).toBe(false);
  });

  it('is safe on empty / nullish input', () => {
    expect(shouldDisableThinking('')).toBe(false);
    expect(shouldDisableThinking(undefined)).toBe(false);
    expect(shouldDisableThinking(null)).toBe(false);
  });
});
