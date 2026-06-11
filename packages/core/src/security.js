const { app } = require('electron');

module.exports = function setupSecurity() {
  app.on('web-contents-created', (event, contents) => {
    contents.on('will-navigate', (event, navigationUrl) => {
      event.preventDefault();
    });
    contents.setWindowOpenHandler(() => {
      return { action: 'deny' };
    });
  });
};
