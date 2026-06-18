// Screenshot capture for the README gallery.
//
// Loads the UI dev server (npm run dev → http://localhost:3000) in a frameless,
// transparent Electron window with NO preload — so the renderer's injectMockApi()
// kicks in and the views fill with realistic mock data. Then it walks the sidebar
// across themes and writes high-quality PNGs into assets/screenshots/.
//
// Usage: npm run dev (in one shell), then: npx electron scripts/screenshots.js

const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');

// ?demo=1 makes the mock backend seed rich data (active guards, snippets,
// launcher profiles, AI briefings) so no view is a bare empty state.
const URL = process.env.SHOT_URL || 'http://localhost:3000/?demo=1';
const OUT = path.join(__dirname, '..', 'assets', 'screenshots');
const W = 1280;
const H = 820;

// [sidebar label, output basename]
const VIEWS = [
  ['Session Guard', 'session-guard'],
  ['Inspector', 'inspector'],
  ['Focus Mode', 'focus-mode'],
  ['Git Pulse', 'git-pulse'],
  ['Port Mapper', 'port-mapper'],
  ['Dev Cleanser', 'dev-cleanser'],
  ['Launchers', 'launchers'],
  ['Snippets', 'snippets'],
  ['Clipboard', 'clipboard'],
  ['OS Power Manager', 'power'],
  ['Settings', 'settings'],
];

// Only this view gets extra theme variants (keeps the asset set tasteful).
const THEME_VARIANTS = {
  oled: ['Git Pulse'],
  dracula: ['Git Pulse'],
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function setTheme(win, theme) {
  await win.webContents.executeJavaScript(
    `document.documentElement.setAttribute('data-theme', ${JSON.stringify(theme)}); true;`
  );
}

// Kill all entrance/transition animation so a capture never lands mid-fade.
async function freezeAnimations(win) {
  await win.webContents.insertCSS(
    '*,*::before,*::after{animation:none!important;transition:none!important;animation-duration:0s!important;animation-delay:0s!important}'
  );
}

// Click the sidebar tab, then wait until React has actually made it the active
// tab (the active tab is the only one carrying the bg-primary dot indicator).
async function gotoTab(win, label) {
  const clicked = await win.webContents.executeJavaScript(`(() => {
    const b = [...document.querySelectorAll('aside button')]
      .find(x => x.textContent.trim().startsWith(${JSON.stringify(label)}));
    if (b) b.click();
    return !!b;
  })()`);
  if (!clicked) return false;
  for (let i = 0; i < 40; i++) {
    const active = await win.webContents.executeJavaScript(`(() => {
      const b = [...document.querySelectorAll('aside button')]
        .find(x => x.textContent.trim().startsWith(${JSON.stringify(label)}));
      return !!(b && b.querySelector('.bg-primary'));
    })()`);
    if (active) return true;
    await sleep(50);
  }
  return true;
}

// Click a button inside the main content area whose text starts with `label`.
async function clickMainButton(win, label) {
  return win.webContents.executeJavaScript(`(() => {
    const b = [...document.querySelectorAll('main button')]
      .find(x => x.textContent.trim().startsWith(${JSON.stringify(label)}));
    if (b) b.click();
    return !!b;
  })()`);
}

async function openPalette(win) {
  await win.webContents.executeJavaScript(
    "window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true })); true;"
  );
}

async function shoot(win, file) {
  await win.webContents.executeJavaScript('window.scrollTo(0,0); true;');
  const img = await win.webContents.capturePage();
  fs.writeFileSync(path.join(OUT, `${file}.png`), img.toPNG());
  console.log('saved', `${file}.png`);
}

app.whenReady().then(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const win = new BrowserWindow({
    x: 0,
    y: 0,
    width: W,
    height: H,
    show: true, // a hidden window doesn't composite live → stale captures
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    webPreferences: {}, // no preload → window.api absent → mockApi injects
  });

  await win.loadURL(URL);
  await sleep(2500); // let mock data populate + fonts settle
  await freezeAnimations(win);

  // Default theme (midnight): every view.
  await setTheme(win, 'midnight');
  for (const [label, file] of VIEWS) {
    const ok = await gotoTab(win, label);
    if (!ok) { console.warn('tab not found:', label); continue; }
    // Dev Cleanser only shows results after a scan — trigger it.
    if (label === 'Dev Cleanser') {
      await clickMainButton(win, 'Scan system');
      await sleep(1100);
    } else {
      await sleep(450);
    }
    await shoot(win, file);
  }

  // The command palette, opened over Git Pulse.
  await gotoTab(win, 'Git Pulse');
  await sleep(300);
  await openPalette(win);
  await sleep(400);
  await shoot(win, 'command-palette');
  await openPalette(win); // Ctrl+K again toggles it closed
  await sleep(200);

  // Alt-theme variants for a few showcase views.
  for (const [theme, labels] of Object.entries(THEME_VARIANTS)) {
    await setTheme(win, theme);
    for (const label of labels) {
      const file = VIEWS.find((v) => v[0] === label)[1];
      await gotoTab(win, label);
      await sleep(450);
      await shoot(win, `${file}-${theme}`);
    }
  }

  // Per-repo AI actions menu, opened over Git Pulse (leaves a modal open).
  await setTheme(win, 'midnight');
  await gotoTab(win, 'Git Pulse');
  await sleep(400);
  await win.webContents.executeJavaScript(
    `(() => { const b = document.querySelector('main button[title="AI actions"]'); if (b) b.click(); return !!b; })()`
  );
  await sleep(450);
  await shoot(win, 'git-ai-actions');

  // First-run onboarding — forced via ?onboarding (reload resets the frozen CSS).
  await win.loadURL(URL.replace('?demo=1', '?demo=1&onboarding=1'));
  await sleep(2000);
  await freezeAnimations(win);
  await setTheme(win, 'midnight');
  await win.webContents.executeJavaScript(
    `(() => { const btns = [...document.querySelectorAll('button')].filter(b => b.textContent.trim() === 'Continue'); if (btns[0]) btns[0].click(); return true; })()`
  );
  await sleep(500);
  await shoot(win, 'onboarding');

  console.log('done');
  app.quit();
});
