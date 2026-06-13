const { ipcMain, app } = require('electron');
const fs = require('fs');
const path = require('path');
const store = require('./store');
const { complete } = require('./complete');

// Registers the renderer-facing AI channels. The key itself never crosses the
// bridge — only its status does. Every model call runs here in MAIN (the
// packaged CSP blocks renderer egress) and is strictly user-triggered: these
// handlers are wired to explicit buttons, never to a view's poll loop.
module.exports = function initAI() {
  ipcMain.handle('ai:getStatus', async () => store.getStatus());
  ipcMain.handle('ai:setKey', async (_event, key) => store.setKey(typeof key === 'string' ? key : ''));

  // Inspector — repo + dev-process summary → a short prioritized briefing.
  // The renderer passes the data it already displays; the prompt is built here.
  ipcMain.handle('ai:insights', async (_event, payload) => {
    const repos = Array.isArray(payload && payload.repos) ? payload.repos.slice(0, 30) : [];
    const processes = Array.isArray(payload && payload.processes) ? payload.processes.slice(0, 30) : [];
    if (!repos.length && !processes.length) return { error: 'no-data' };
    const summary = JSON.stringify({ repos, processes });
    return complete({
      feature: 'insights',
      cacheKey: summary,
      maxTokens: 800,
      system:
        'You are a senior dev-environment auditor. Given JSON describing the developer\'s tracked git repositories (dirty file counts, ahead/behind, risk flags, docs readiness) and running dev processes, produce a SHORT prioritized briefing: the 3–5 most important things to act on, most urgent first, one line each. Be concrete and name the repo. Plain text with "•" bullets — no markdown headers, no preamble.',
      user: summary,
    });
  });

  // Power Manager — recent power events + state → a plain-English explanation.
  ipcMain.handle('ai:explainPower', async (_event, payload) => {
    const events = Array.isArray(payload && payload.events) ? payload.events.slice(0, 50) : [];
    if (!events.length) return { error: 'no-data' };
    const summary = JSON.stringify({ profile: payload && payload.profile, onBattery: payload && payload.onBattery, events });
    return complete({
      feature: 'power',
      cacheKey: summary,
      maxTokens: 500,
      system:
        'You are a power-management assistant. Given the current power mode, AC/battery state, and a log of recent power events (OS_EVENT, AI_AGENT switches, user ACTIONs), explain in 2–4 short sentences what has been happening and whether the current setup is sensible for a laptop developer. Plain text, no markdown, no preamble.',
      user: summary,
    });
  });

  // Inspector — read the tail of today's app log in MAIN and triage it. No
  // renderer data and never a file path on the bridge: main reads it directly.
  ipcMain.handle('ai:analyzeLogs', async () => {
    let tail = '';
    try {
      const file = path.join(app.getPath('userData'), 'logs', `onyx-${new Date().toISOString().split('T')[0]}.log`);
      tail = fs.readFileSync(file, 'utf8').split('\n').slice(-300).join('\n');
    } catch {
      return { error: 'no-logs' };
    }
    if (!tail.trim()) return { error: 'no-logs' };
    return complete({
      feature: 'logs',
      cacheKey: String(tail.length) + tail.slice(-256),
      maxTokens: 1000,
      system:
        'You are a triage assistant reading the tail of an Electron app log. Group the notable problems (errors, repeated warnings); for each give a probable cause and a one-line suggested fix. If nothing stands out, say the logs look healthy. Plain text with "•" bullets — no markdown headers, no preamble.',
      user: tail,
    });
  });
};
