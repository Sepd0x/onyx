// Rasterizes assets/icon.svg into the PNG/ICO assets the app and installer need.
// Run with: npm run generate:icon
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const pngToIcoMod = require('png-to-ico');
const pngToIco = pngToIcoMod.default || pngToIcoMod;

const ASSETS = path.join(__dirname, '..', 'assets');
const SVG = path.join(ASSETS, 'icon.svg');

async function render(size) {
  // High density gives crisp downscaling for small sizes.
  return sharp(SVG, { density: 384 }).resize(size, size, { fit: 'contain' }).png().toBuffer();
}

async function main() {
  if (!fs.existsSync(SVG)) throw new Error(`Missing ${SVG}`);

  // Window / taskbar icon (PNG is nativeImage-friendly cross-platform).
  fs.writeFileSync(path.join(ASSETS, 'icon.png'), await render(256));

  // Tray icon (small + crisp).
  fs.writeFileSync(path.join(ASSETS, 'tray.png'), await render(32));

  // Multi-resolution Windows .ico for electron-builder (installer + exe).
  const sizes = [16, 24, 32, 48, 64, 128, 256];
  const buffers = await Promise.all(sizes.map(render));
  fs.writeFileSync(path.join(ASSETS, 'icon.ico'), await pngToIco(buffers));

  console.log('Generated assets/icon.png, assets/tray.png, assets/icon.ico');
}

main().catch((e) => { console.error(e); process.exit(1); });
