'use strict';

function getDisplayState(options = {}) {
  const enabled = options.enabled !== false;
  const showStatusBar = options.showStatusBar !== false;
  const count = normalizeCount(options.count);
  const badgeCount = enabled ? count : 0;
  const statusVisible = enabled && showStatusBar && count > 0;

  return {
    badgeCount,
    statusVisible,
    statusText: statusVisible ? `$(bell-dot) Codex ${count}` : '',
    statusTooltip: statusVisible
      ? `${count} unread Codex ${count === 1 ? 'reply or question' : 'replies or questions'}. ` +
        'Click to open Codex and mark them read.'
      : ''
  };
}

function normalizeCount(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.max(0, Math.floor(numeric)) : 0;
}

module.exports = {
  getDisplayState,
  normalizeCount
};
