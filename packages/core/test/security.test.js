import { describe, it, expect, vi } from 'vitest';

const fakeApp = {
    on: (event, handler) => {
        if (event === 'web-contents-created') {
            handler(null, fakeContents);
        }
    }
};

let openHandler = null;
let navHandler = null;
let preventDefaultCalled = false;

const fakeEvent = { preventDefault: () => { preventDefaultCalled = true; } };

const fakeContents = {
    on: (event, handler) => {
        if (event === 'will-navigate') navHandler = handler;
    },
    setWindowOpenHandler: (handler) => {
        openHandler = handler;
    }
};

vi.mock('electron', () => ({
    app: {
        on: (event, handler) => {
            if (event === 'web-contents-created') {
                // simulate immediately
                handler(null, fakeContents);
            }
        }
    }
}));

describe('Security Setup', () => {
    it('should set up window open handler to deny new windows', () => {
        const setup = require('../src/security');
        setup();
        
        expect(openHandler).not.toBeNull();
        const action = openHandler();
        expect(action).toEqual({ action: 'deny' });
        
        expect(navHandler).not.toBeNull();
        navHandler(fakeEvent, 'http://external.com');
        expect(preventDefaultCalled).toBe(true);
    });
});
