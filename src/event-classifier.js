'use strict';

const path = require('node:path');

function isUserVscodeSession(record, workspaceRoots = []) {
  if (!record || record.type !== 'session_meta' || !record.payload) {
    return false;
  }

  const meta = record.payload;
  if (
    meta.originator !== 'codex_vscode' ||
    meta.thread_source !== 'user' ||
    meta.source !== 'vscode'
  ) {
    return false;
  }

  if (!Array.isArray(workspaceRoots) || workspaceRoots.length === 0) {
    return true;
  }

  if (typeof meta.cwd !== 'string' || meta.cwd.length === 0) {
    return false;
  }

  return workspaceRoots.some((root) => isPathInside(root, meta.cwd));
}

function isPathInside(root, candidate) {
  if (typeof root !== 'string' || typeof candidate !== 'string') {
    return false;
  }

  const resolvedRoot = normalizePath(root);
  const resolvedCandidate = normalizePath(candidate);
  const relative = path.relative(resolvedRoot, resolvedCandidate);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function normalizePath(value) {
  const resolved = path.resolve(value);
  return process.platform === 'win32' ? resolved.toLowerCase() : resolved;
}

function getThreadId(sessionMeta) {
  const payload = sessionMeta?.payload;
  if (!payload) {
    return undefined;
  }

  const value = payload.id || payload.session_id;
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function classifyRecord(record) {
  if (!record || !record.payload) {
    return undefined;
  }

  const payload = record.payload;

  if (
    record.type === 'event_msg' &&
    payload.type === 'task_complete' &&
    typeof payload.turn_id === 'string'
  ) {
    return {
      kind: 'reply',
      eventId: `turn:${payload.turn_id}`
    };
  }

  if (
    record.type === 'response_item' &&
    (payload.type === 'function_call' || payload.type === 'custom_tool_call') &&
    payload.name === 'request_user_input'
  ) {
    const callId = payload.call_id || payload.id;
    if (typeof callId === 'string' && callId.length > 0) {
      return {
        kind: 'question',
        eventId: `question:${callId}`
      };
    }
  }

  if (
    record.type === 'event_msg' &&
    payload.type === 'request_user_input' &&
    typeof payload.call_id === 'string'
  ) {
    return {
      kind: 'question',
      eventId: `question:${payload.call_id}`
    };
  }

  return undefined;
}

class UnreadCounter {
  constructor(initialState = {}) {
    this._counts = new Map();
    if (initialState && typeof initialState === 'object') {
      for (const [threadId, rawCount] of Object.entries(initialState)) {
        const count = Number.parseInt(rawCount, 10);
        if (threadId && Number.isFinite(count) && count > 0) {
          this._counts.set(threadId, count);
        }
      }
    }
  }

  increment(threadId) {
    if (!threadId) {
      return this.total;
    }
    this._counts.set(threadId, (this._counts.get(threadId) || 0) + 1);
    return this.total;
  }

  clearThread(threadId) {
    if (!threadId) {
      return false;
    }
    return this._counts.delete(threadId);
  }

  clearAll() {
    const changed = this._counts.size > 0;
    this._counts.clear();
    return changed;
  }

  get total() {
    let total = 0;
    for (const count of this._counts.values()) {
      total += count;
    }
    return total;
  }

  getThreadCount(threadId) {
    return this._counts.get(threadId) || 0;
  }

  toJSON() {
    return Object.fromEntries(this._counts);
  }
}

module.exports = {
  UnreadCounter,
  classifyRecord,
  getThreadId,
  isPathInside,
  isUserVscodeSession
};
