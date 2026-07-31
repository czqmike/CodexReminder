'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const {
  buildPowerShellArgs,
  normalizeBadgeCount,
  runPowerShellBadge
} = require('../src/taskbar-badge');

test('badge count is bounded and uses max plus one for overflow', () => {
  assert.equal(normalizeBadgeCount(-1, 99), 0);
  assert.equal(normalizeBadgeCount(7.8, 99), 7);
  assert.equal(normalizeBadgeCount(500, 99), 100);
  assert.equal(normalizeBadgeCount(Number.NaN, 99), 0);
});

test('workspace names remain a single PowerShell argument', () => {
  const workspaceName = "demo'; Write-Error 'unexpected $(value)";
  const args = buildPowerShellArgs({
    count: 7,
    maxCount: 99,
    scriptPath: 'C:\\Program Files\\Codex Reminder\\badge.ps1',
    workspaceName
  });
  const index = args.indexOf('-WorkspaceName');
  assert.ok(index > 0);
  assert.equal(args[index + 1], workspaceName);
  assert.equal(args.filter((item) => item === workspaceName).length, 1);
});

test('non-Windows platforms never spawn PowerShell', async () => {
  let called = false;
  await runPowerShellBadge({
    platform: 'linux',
    spawn: () => {
      called = true;
      throw new Error('must not be called');
    }
  });
  assert.equal(called, false);
});
