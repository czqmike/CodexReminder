'use strict';

function normalizeConfig(raw = {}) {
  return {
    enabled: raw.enabled ?? true,
    showStatusBar: raw.showStatusBar ?? true,
    clearActiveThreadOnFocus: raw.clearActiveThreadOnFocus ?? true,
    pollIntervalMs: clamp(raw.pollIntervalMs ?? 1000, 300, 10000),
    maxTaskbarCount: clamp(raw.maxTaskbarCount ?? 99, 1, 999),
    codexHome: typeof raw.codexHome === 'string' ? raw.codexHome.trim() : ''
  };
}

function clamp(value, min, max) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return min;
  }
  return Math.min(Math.max(Math.floor(numeric), min), max);
}

module.exports = {
  clamp,
  normalizeConfig
};
