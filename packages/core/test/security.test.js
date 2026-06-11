import { describe, it, expect, vi } from 'vitest';
import setupSecurity from '../src/security.js';

function fakeContents() {
  const handlers = {};
  return {
    on: (event, h) => { handlers[event] = h; },
    setWindowOpenHandler: (h) => { handlers.windowOpen = h; },
    handlers,
  };
}

describe('setupSecurity', () => {
  it('denies new windows and blocks in-page navigation', () => {
    let contents;
    const app = {
      isPackaged: false,
      on: (event, h) => { if (event === 'web-contents-created') h(null, (contents = fakeContents())); },
    };

    setupSecurity({ app, session: undefined });

    expect(contents.handlers.windowOpen()).toEqual({ action: 'deny' });

    const event = { preventDefault: vi.fn() };
    contents.handlers['will-navigate'](event);
    expect(event.preventDefault).toHaveBeenCalledOnce();
  });

  it('sets a strict CSP header when packaged', () => {
    let onHeaders;
    const app = { isPackaged: true, on: () => {} };
    const session = { defaultSession: { webRequest: { onHeadersReceived: (fn) => { onHeaders = fn; } } } };

    setupSecurity({ app, session });

    let result;
    onHeaders({ responseHeaders: { 'X-Test': ['1'] } }, (r) => { result = r; });
    const csp = result.responseHeaders['Content-Security-Policy'][0];
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).not.toContain("unsafe-eval");
    // existing headers are preserved
    expect(result.responseHeaders['X-Test']).toEqual(['1']);
  });

  it('does not set CSP in development (not packaged)', () => {
    let called = false;
    const app = { isPackaged: false, on: () => {} };
    const session = { defaultSession: { webRequest: { onHeadersReceived: () => { called = true; } } } };
    setupSecurity({ app, session });
    expect(called).toBe(false);
  });
});
