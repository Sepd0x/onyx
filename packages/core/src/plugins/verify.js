const crypto = require('crypto');

// Ed25519 signing primitives for plugin bundles (Fase 2). Node built-in crypto only —
// no native deps, small detached signatures. The app ships ONLY the public key
// (public-key.js); the private key is generated offline by infra/plugin-signing/keygen.js
// and never leaves the owner's machine.
//
// A bundle is signed over a CANONICAL DIGEST of its files (each file's content hash,
// keyed by path, sorted) so reordering files or flipping a single byte invalidates the
// signature. The digest is what gets signed/verified — never the raw bytes ad hoc.

function sha256(buf) { return crypto.createHash('sha256').update(buf).digest(); }

// entries: [{ path: string, data: Buffer|string }]. Order-independent, tamper-evident.
function canonicalDigest(entries) {
  const lines = (entries || [])
    .map((e) => ({ path: String(e.path), data: Buffer.isBuffer(e.data) ? e.data : Buffer.from(String(e.data)) }))
    .sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0))
    .map((e) => `${sha256(e.data).toString('hex')}  ${e.path}`);
  return sha256(Buffer.from(lines.join('\n'), 'utf8'));
}

function generateKeyPair() {
  return crypto.generateKeyPairSync('ed25519', {
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
}

function sign(digest, privateKeyPem) {
  return crypto.sign(null, digest, privateKeyPem).toString('base64');
}

// Fails closed: an empty/invalid key or signature returns false and never throws, so a
// missing public key (key not yet generated) means NO plugin can ever be trusted.
function verify(digest, signatureB64, publicKeyPem) {
  try {
    if (!publicKeyPem || !signatureB64) return false;
    return crypto.verify(null, digest, publicKeyPem, Buffer.from(String(signatureB64), 'base64'));
  } catch { return false; }
}

module.exports = { canonicalDigest, generateKeyPair, sign, verify, sha256 };
