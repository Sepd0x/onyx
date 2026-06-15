// Rasterizes assets/icon.svg into the PNG/ICO assets the app and installer need.
// Run with: npm run generate:icon
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const pngToIcoMod = require('png-to-ico');
const pngToIco = pngToIcoMod.default || pngToIcoMod;

const ASSETS = path.join(__dirname, '..', 'assets');
const SVG = path.join(ASSETS, 'icon.svg');           // framed dark tile (installer / app tile)
const SVG_BARE = path.join(ASSETS, 'icon-bare.svg'); // transparent gem (tray / taskbar)

async function render(svg, size) {
  // High density gives crisp downscaling for small sizes.
  return sharp(svg, { density: 384 }).resize(size, size, { fit: 'contain' }).png().toBuffer();
}

async function main() {
  if (!fs.existsSync(SVG)) throw new Error(`Missing ${SVG}`);
  if (!fs.existsSync(SVG_BARE)) throw new Error(`Missing ${SVG_BARE}`);

  // Window / taskbar + tray icons use the TRANSPARENT gem so they read light next
  // to neighbouring app icons (audit #12) instead of a heavy black square.
  fs.writeFileSync(path.join(ASSETS, 'icon.png'), await render(SVG_BARE, 256));
  fs.writeFileSync(path.join(ASSETS, 'tray.png'), await render(SVG_BARE, 32));

  // The installer + .exe icon keeps the framed dark tile (looks right as an app
  // tile / in the installer chrome). Multi-resolution Windows .ico.
  const sizes = [16, 24, 32, 48, 64, 128, 256];
  const buffers = await Promise.all(sizes.map((s) => render(SVG, s)));
  fs.writeFileSync(path.join(ASSETS, 'icon.ico'), await pngToIco(buffers));

  console.log('Generated assets/icon.png + tray.png (transparent), assets/icon.ico (framed)');
}

main().catch((e) => { console.error(e); process.exit(1); });
