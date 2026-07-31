'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { clamp, normalizeConfig } = require('../src/config');

test('configuration defaults are stable', () => {
  assert.deepEqual(normalizeConfig(), {
    enabled: true,
    showStatusBar: true,
    clearActiveThreadOnFocus: true,
    pollIntervalMs: 1000,
    maxTaskbarCount: 99,
    codexHome: ''
  });
});

test('configuration values are normalized and bounded', () => {
  assert.deepEqual(
    normalizeConfig({
      enabled: false,
      showStatusBar: false,
      clearActiveThreadOnFocus: false,
      pollIntervalMs: 99,
      maxTaskbarCount: 10000,
      codexHome: '  C:\\Codex Home  '
    }),
    {
      enabled: false,
      showStatusBar: false,
      clearActiveThreadOnFocus: false,
      pollIntervalMs: 300,
      maxTaskbarCount: 999,
      codexHome: 'C:\\Codex Home'
    }
  );
  assert.equal(clamp(Number.NaN, 1, 9), 1);
  assert.equal(clamp(4.9, 1, 9), 4);
});
