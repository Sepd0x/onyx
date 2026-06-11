// Hardens web contents and (in production) enforces a strict Content-Security-Policy.
// `deps` is injectable so the module can be unit-tested without a real Electron runtime;
// it defaults to the real electron module in production.
module.exports = function setupSecurity(deps) {
  const { app, session } = deps || require('electron');

  app.on('web-contents-created', (event, contents) => {
    contents.on('will-navigate', (e) => { e.preventDefault(); });
    contents.setWindowOpenHandler(() => ({ action: 'deny' }));
  });

  // CSP only in the packaged app — the Vite dev server needs a relaxed policy for HMR.
  if (app.isPackaged && session && session.defaultSession) {
    session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
      callback({
        responseHeaders: {
          ...details.responseHeaders,
          'Content-Security-Policy': [
            "default-src 'self'; " +
            "script-src 'self'; " +
            "style-src 'self' 'unsafe-inline'; " +
            "img-src 'self' data:; " +
            "font-src 'self' data:; " +
            "connect-src 'self'; " +
            "object-src 'none'; " +
            "base-uri 'none'; " +
            "frame-src 'none'"
          ]
        }
      });
    });
  }
};
