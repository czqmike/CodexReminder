'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const manifest = readJson('package.json');

assert.equal(manifest.name, 'codex-reminder');
assert.equal(manifest.displayName, 'Codex Reminder');
assert.match(manifest.version, /^\d+\.\d+\.\d+$/, 'Manifest version must be stable SemVer');
assert.equal(manifest.publisher, 'czqmike');
assert.equal(manifest.license, 'SEE LICENSE IN LICENSE');
assert.equal(manifest.engines?.vscode, '^1.130.0');
assert.deepEqual(manifest.extensionKind, ['ui']);
assert.deepEqual(manifest.extensionDependencies, ['openai.chatgpt']);
assert.equal(manifest.pricing, 'Free');
assert.equal(Object.hasOwn(manifest, 'preview'), false);
assert.equal(manifest.capabilities?.untrustedWorkspaces?.supported, true);
assert.equal(manifest.capabilities?.virtualWorkspaces?.supported, false);
assert.equal(manifest.repository?.url, 'https://github.com/czqmike/CodexReminder.git');
assert.equal(manifest.bugs?.url, 'https://github.com/czqmike/CodexReminder/issues');

const expectedCommands = [
  'codexReminder.openCodex',
  'codexReminder.clear',
  'codexReminder.test',
  'codexReminder.showOutput'
];
assert.deepEqual(manifest.contributes.commands.map((item) => item.command), expectedCommands);

const expectedSettings = [
  'codexReminder.enabled',
  'codexReminder.showStatusBar',
  'codexReminder.clearActiveThreadOnFocus',
  'codexReminder.pollIntervalMs',
  'codexReminder.maxTaskbarCount',
  'codexReminder.codexHome'
];
assert.deepEqual(Object.keys(manifest.contributes.configuration.properties), expectedSettings);

for (const relative of [
  'README.md',
  'CHANGELOG.md',
  'LICENSE',
  'SUPPORT.md',
  'SECURITY.md',
  'images/icon.png',
  'images/taskbar-badge.png',
  'images/status-bar.png',
  'scripts/set-taskbar-badge.ps1'
]) {
  assert.equal(fs.existsSync(path.join(root, relative)), true, `Required file is missing: ${relative}`);
}
for (const relative of [
  'scripts/package.ps1',
  'build/extension.vsixmanifest',
  'build/[Content_Types].xml'
]) {
  assert.equal(fs.existsSync(path.join(root, relative)), false, `Legacy packaging file remains: ${relative}`);
}

const icon = readPngDimensions('images/icon.png');
assert.ok(icon.width >= 256 && icon.height >= 256, 'Marketplace icon must be at least 256x256');
for (const relative of ['images/taskbar-badge.png', 'images/status-bar.png']) {
  const dimensions = readPngDimensions(relative);
  assert.ok(dimensions.width >= 1000 && dimensions.height >= 400, `${relative} is too small`);
}

const readme = fs.readFileSync(path.join(root, 'README.md'), 'utf8');
assert.match(readme, /Unofficial community extension/);
assert.match(readme, /非官方社区扩展/);
for (const match of readme.matchAll(/!\[[^\]]*\]\(([^)]+)\)/g)) {
  const image = match[1];
  assert.doesNotMatch(image, /^http:\/\//i, `README image must use HTTPS: ${image}`);
  assert.doesNotMatch(image, /\.svg(?:$|[?#])/i, `README may not embed SVG: ${image}`);
}

console.log('Marketplace manifest and assets verified.');

function readJson(relative) {
  return JSON.parse(fs.readFileSync(path.join(root, relative), 'utf8'));
}

function readPngDimensions(relative) {
  const bytes = fs.readFileSync(path.join(root, relative));
  assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', `${relative} is not a PNG`);
  return {
    width: bytes.readUInt32BE(16),
    height: bytes.readUInt32BE(20)
  };
}
