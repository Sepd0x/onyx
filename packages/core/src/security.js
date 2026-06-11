const { app, session } = require('electron');

module.exports = function setupSecurity() {
  // Block in-page navigations and new-window/popups from any web contents.
  app.on('web-contents-created', (event, contents) => {
    contents.on('will-navigate', (e) => {
      e.preventDefault();
    });
    contents.setWindowOpenHandler(() => {
      return { action: 'deny' };
    });
  });

  // Enforce a strict Content-Security-Policy on the packaged app.
  // (Skipped in dev: the Vite dev server needs a relaxed policy for HMR.)
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
