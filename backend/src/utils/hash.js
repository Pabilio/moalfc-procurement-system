// src/utils/hash.js
// -----------------------------------------------------------------------
// SHA-256 file hashing + integrity verification -- the core guarantee
// behind the "immutable document vault" (Module 2). A document's hash
// is computed once at upload and never changes; re-hashing the file on
// disk at any later point and comparing proves it hasn't been tampered
// with or silently swapped.
// -----------------------------------------------------------------------

const fs = require('fs');
const crypto = require('crypto');

function hashBuffer(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function hashFile(filePath) {
  return hashBuffer(fs.readFileSync(filePath));
}

function verifyIntegrity(document) {
  if (!fs.existsSync(document.file_path)) {
    return { ok: false, reason: 'File missing from disk', currentHash: null };
  }
  const currentHash = hashFile(document.file_path);
  const ok = currentHash === document.sha256_hash;
  return { ok, currentHash, reason: ok ? null : 'Hash mismatch -- file does not match its original upload' };
}

module.exports = { hashBuffer, hashFile, verifyIntegrity };
