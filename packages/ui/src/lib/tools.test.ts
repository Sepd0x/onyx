import { describe, it, expect } from 'vitest';
import { TOOLS, isToolEnabled } from './tools';

describe('isToolEnabled', () => {
  it('enables every tool by default (empty/absent disabled list)', () => {
    for (const t of TOOLS) {
      if (t.requiresAI) continue; // covered separately
      expect(isToolEnabled(t.id, {})).toBe(true);
      expect(isToolEnabled(t.id, { disabledTools: [] })).toBe(true);
    }
  });

  it('disables a tool listed in disabledTools', () => {
    expect(isToolEnabled('ports', { disabledTools: ['ports'] })).toBe(false);
    expect(isToolEnabled('git', { disabledTools: ['ports'] })).toBe(true);
  });

  it('gates an AI tool on the AI master switch as well', () => {
    expect(isToolEnabled('aiauditor', { enableAIFeatures: true })).toBe(true);
    expect(isToolEnabled('aiauditor', {})).toBe(true); // AI defaults on
    expect(isToolEnabled('aiauditor', { enableAIFeatures: false })).toBe(false);
    // disabled list still wins even with AI on
    expect(isToolEnabled('aiauditor', { enableAIFeatures: true, disabledTools: ['aiauditor'] })).toBe(false);
  });

  it('treats an unknown id as enabled unless explicitly disabled', () => {
    expect(isToolEnabled('nope', {})).toBe(true);
    expect(isToolEnabled('nope', { disabledTools: ['nope'] })).toBe(false);
  });
});
