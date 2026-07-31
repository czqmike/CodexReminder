'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

const vsixPath = path.resolve(process.argv[2] || 'dist/codex-reminder.vsix');
const archive = fs.readFileSync(vsixPath);
const entries = readZip(archive);
const names = new Set(entries.keys());

const required = [
  'extension/package.json',
  'extension/readme.md',
  'extension/changelog.md',
  'extension/license.txt',
  'extension/support.md',
  'extension/security.md',
  'extension/images/icon.png',
  'extension/images/taskbar-badge.png',
  'extension/images/status-bar.png',
  'extension/scripts/set-taskbar-badge.ps1',
  'extension/src/config.js',
  'extension/src/display-state.js',
  'extension/src/event-classifier.js',
  'extension/src/extension.js',
  'extension/src/session-monitor.js',
  'extension/src/taskbar-badge.js'
];
for (const name of required) {
  assert.ok(names.has(name), `VSIX is missing ${name}`);
}

const forbidden = [
  /(^|\/)(?:\.git|\.github|\.vscode|build|dist|test)(?:\/|$)/,
  /(?:^|\/)package-lock\.json$/,
  /(?:^|\/)scripts\/(?:check-release|create-marketplace-assets|verify-manifest|verify-vsix)\.(?:js|ps1)$/,
  /(?:^|\/)scripts\/package\.ps1$/,
  /\.vsix$/,
  /\.log$/
];
for (const name of names) {
  for (const pattern of forbidden) {
    assert.doesNotMatch(name, pattern, `Forbidden file packaged: ${name}`);
  }
}

const manifest = JSON.parse(readEntry(entries, 'extension/package.json').toString('utf8'));
assert.equal(manifest.name, 'codex-reminder');
assert.equal(manifest.version, '1.0.0');
assert.equal(manifest.publisher, 'czqmike');
assert.equal(manifest.engines.vscode, '^1.130.0');
assert.deepEqual(manifest.extensionDependencies, ['openai.chatgpt']);
assert.equal(manifest.icon, 'images/icon.png');

const packagedReadme = readEntry(entries, 'extension/readme.md').toString('utf8');
const sourceReadme = fs.readFileSync(path.resolve(__dirname, '..', 'README.md'), 'utf8');
assert.equal(
  normalizeMarkdownTargets(packagedReadme),
  normalizeMarkdownTargets(sourceReadme),
  'Packaged README content is stale'
);

const secretPatterns = [
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /\bgh[pousr]_[A-Za-z0-9_]{36,}\b/,
  /\bgithub_pat_[A-Za-z0-9_]{20,}\b/,
  /\bsk-[A-Za-z0-9_-]{20,}\b/,
  /\bAZDO[A-Za-z0-9]{40,}\b/
];
for (const [name, entry] of entries) {
  if (!/\.(?:json|js|md|ps1|txt|xml|ya?ml)$/i.test(name)) {
    continue;
  }
  const text = readEntry(entries, name).toString('utf8');
  for (const pattern of secretPatterns) {
    assert.doesNotMatch(text, pattern, `Possible secret detected in ${name}`);
  }
}

const digest = crypto.createHash('sha256').update(archive).digest('hex');
console.log(`VSIX verified: ${path.basename(vsixPath)} (${archive.length} bytes)`);
console.log(`SHA256 ${digest}`);

function normalizeMarkdownTargets(markdown) {
  return markdown.replace(/(!?\[[^\]]*\])\([^)]+\)/g, '$1()');
}

function readZip(bytes) {
  const eocdSignature = Buffer.from([0x50, 0x4b, 0x05, 0x06]);
  const eocd = bytes.lastIndexOf(eocdSignature);
  assert.ok(eocd >= 0, 'Invalid ZIP: end-of-central-directory record not found');
  const count = bytes.readUInt16LE(eocd + 10);
  let offset = bytes.readUInt32LE(eocd + 16);
  const result = new Map();

  for (let index = 0; index < count; index += 1) {
    assert.equal(bytes.readUInt32LE(offset), 0x02014b50, 'Invalid ZIP central directory');
    const compression = bytes.readUInt16LE(offset + 10);
    const compressedSize = bytes.readUInt32LE(offset + 20);
    const uncompressedSize = bytes.readUInt32LE(offset + 24);
    const nameLength = bytes.readUInt16LE(offset + 28);
    const extraLength = bytes.readUInt16LE(offset + 30);
    const commentLength = bytes.readUInt16LE(offset + 32);
    const localOffset = bytes.readUInt32LE(offset + 42);
    const name = bytes
      .subarray(offset + 46, offset + 46 + nameLength)
      .toString('utf8')
      .replaceAll('\\', '/')
      .toLowerCase();
    result.set(name, { compression, compressedSize, uncompressedSize, localOffset });
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return result;
}

function readEntry(entries, name) {
  const entry = entries.get(name);
  assert.ok(entry, `ZIP entry not found: ${name}`);
  assert.equal(archive.readUInt32LE(entry.localOffset), 0x04034b50, `Invalid local header for ${name}`);
  const nameLength = archive.readUInt16LE(entry.localOffset + 26);
  const extraLength = archive.readUInt16LE(entry.localOffset + 28);
  const start = entry.localOffset + 30 + nameLength + extraLength;
  const compressed = archive.subarray(start, start + entry.compressedSize);
  let output;
  if (entry.compression === 0) {
    output = compressed;
  } else if (entry.compression === 8) {
    output = zlib.inflateRawSync(compressed);
  } else {
    throw new Error(`Unsupported ZIP compression ${entry.compression} for ${name}`);
  }
  assert.equal(output.length, entry.uncompressedSize, `Unexpected size for ${name}`);
  return output;
}
