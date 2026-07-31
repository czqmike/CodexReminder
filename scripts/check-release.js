'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const tag = process.argv[2] || process.env.GITHUB_REF_NAME || '';
assert.match(tag, /^v\d+\.\d+\.\d+$/, `Release tag must use vX.Y.Z, received: ${tag || '(empty)'}`);

const manifest = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const version = tag.slice(1);
assert.equal(manifest.version, version, `Tag ${tag} does not match package version ${manifest.version}`);
assert.equal(manifest.publisher, 'czqmike');
assert.equal(Object.hasOwn(manifest, 'preview'), false, 'Stable releases must not set preview');

const changelog = fs.readFileSync(path.join(root, 'CHANGELOG.md'), 'utf8');
assert.match(
  changelog,
  new RegExp(`^## \\[${version.replaceAll('.', '\\.') }\\] - \\d{4}-\\d{2}-\\d{2}$`, 'm'),
  `CHANGELOG.md must contain a dated ${version} heading`
);

console.log(`Release metadata verified for ${tag}.`);
