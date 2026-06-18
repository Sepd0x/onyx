#!/usr/bin/env node
// Sign a plugin bundle so Onyx will trust it.
//
//   node infra/plugin-signing/sign.js <path-to-plugin-folder>
//
// The folder must contain manifest.json + the files it references. This validates the
// manifest, computes the canonical digest over EVERY file (except the signature itself),
// signs it with onyx-plugin-private.pem, and writes <folder>/onyx.sig (base64). The app
// recomputes the same digest at install time and refuses to load if it doesn't match.

const fs = require('fs');
const path = require('path');
const { validateManifest } = require('../../packages/core/src/plugins/manifest');
const { canonicalDigest, sign } = require('../../packages/core/src/plugins/verify');

const SIG_NAME = 'onyx.sig';
const dir = process.argv[2];
if (!dir) { console.error('Usage: node infra/plugin-signing/sign.js <plugin-folder>'); process.exit(1); }

const privPath = path.join(__dirname, 'onyx-plugin-private.pem');
if (!fs.existsSync(privPath)) { console.error('No private key found. Run keygen.js first.'); process.exit(1); }

const manifestPath = path.join(dir, 'manifest.json');
if (!fs.existsSync(manifestPath)) { console.error('No manifest.json in ' + dir); process.exit(1); }

let manifest;
try { manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')); }
catch (e) { console.error('manifest.json is not valid JSON: ' + e.message); process.exit(1); }

const res = validateManifest(manifest);
if (!res.ok) { console.error('Invalid manifest:\n - ' + res.errors.join('\n - ')); process.exit(1); }

// Every file in the folder except the signature itself goes into the digest.
const entries = [];
for (const name of fs.readdirSync(dir)) {
  if (name === SIG_NAME) continue;
  const full = path.join(dir, name);
  if (fs.statSync(full).isFile()) entries.push({ path: name, data: fs.readFileSync(full) });
}

const digest = canonicalDigest(entries);
const signature = sign(digest, fs.readFileSync(privPath, 'utf8'));
fs.writeFileSync(path.join(dir, SIG_NAME), signature);
console.log(`✓ Signed ${res.value.id} v${res.value.version} (${entries.length} files) → ${SIG_NAME}`);
