'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { getDisplayState, normalizeCount } = require('../src/display-state');

test('disabled reminders clear both badge and status presentation', () => {
  assert.deepEqual(getDisplayState({ enabled: false, showStatusBar: true, count: 4 }), {
    badgeCount: 0,
    statusVisible: false,
    statusText: '',
    statusTooltip: ''
  });
});

test('enabled reminders show the normalized unread count', () => {
  const state = getDisplayState({ enabled: true, showStatusBar: true, count: 2.9 });
  assert.equal(state.badgeCount, 2);
  assert.equal(state.statusVisible, true);
  assert.equal(state.statusText, '$(bell-dot) Codex 2');
  assert.match(state.statusTooltip, /2 unread Codex replies or questions/);
});

test('status bar can be hidden without clearing the taskbar count', () => {
  const state = getDisplayState({ enabled: true, showStatusBar: false, count: 3 });
  assert.equal(state.badgeCount, 3);
  assert.equal(state.statusVisible, false);
  assert.equal(normalizeCount(-5), 0);
  assert.equal(normalizeCount('not-a-number'), 0);
});
