const fs = require('fs');
const path = require('path');
const { app } = require('electron');

let logFile = null;
if (app) {
    const logDir = path.join(app.getPath('userData'), 'logs');
    if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
    }
    logFile = path.join(logDir, `onyx-${new Date().toISOString().split('T')[0]}.log`);
} else {
    logFile = path.join(__dirname, 'onyx-fallback.log');
}

function writeLog(level, message, meta = {}) {
    if (!logFile) return;
    const timestamp = new Date().toISOString();
    const metaString = Object.keys(meta).length ? JSON.stringify(meta) : '';
    const logLine = `[${timestamp}] [${level.toUpperCase()}] ${message} ${metaString}\n`;
    try {
        fs.appendFileSync(logFile, logLine, 'utf8');
    } catch (e) {
        console.error('Failed to write to log file:', e);
    }
}

module.exports = {
  info: (msg, meta) => writeLog('info', msg, meta),
  warn: (msg, meta) => writeLog('warn', msg, meta),
  error: (msg, meta) => writeLog('error', msg, meta),
  debug: (msg, meta) => writeLog('debug', msg, meta)
};
