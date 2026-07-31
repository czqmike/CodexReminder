'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');
const {
  UnreadCounter,
  classifyRecord,
  isPathInside,
  isUserVscodeSession
} = require('../src/event-classifier');

const workspaceRoot = path.resolve('test-fixtures', 'workspace');
const nestedWorkspace = path.join(workspaceRoot, 'demo');
const otherWorkspace = path.resolve('test-fixtures', 'workspace-other');

function meta(overrides = {}) {
  return {
    type: 'session_meta',
    payload: {
      originator: 'codex_vscode',
      thread_source: 'user',
      source: 'vscode',
      cwd: nestedWorkspace,
      id: 'thread-1',
      ...overrides
    }
  };
}

test('accepts a user VS Code session in any current workspace root', () => {
  assert.equal(isUserVscodeSession(meta(), [nestedWorkspace]), true);
  assert.equal(isUserVscodeSession(meta(), [otherWorkspace, workspaceRoot]), true);
});

test('rejects subagent, CLI, and other-workspace sessions', () => {
  assert.equal(
    isUserVscodeSession(meta({ thread_source: 'subagent' }), [nestedWorkspace]),
    false
  );
  assert.equal(
    isUserVscodeSession(meta({ source: 'cli' }), [nestedWorkspace]),
    false
  );
  assert.equal(isUserVscodeSession(meta(), [otherWorkspace]), false);
});

test('classifies task completion as a reply', () => {
  assert.deepEqual(
    classifyRecord({
      type: 'event_msg',
      payload: { type: 'task_complete', turn_id: 'turn-1' }
    }),
    { kind: 'reply', eventId: 'turn:turn-1' }
  );
});

test('classifies both request_user_input event formats as questions', () => {
  assert.deepEqual(
    classifyRecord({
      type: 'response_item',
      payload: {
        type: 'custom_tool_call',
        name: 'request_user_input',
        call_id: 'call-1'
      }
    }),
    { kind: 'question', eventId: 'question:call-1' }
  );
  assert.deepEqual(
    classifyRecord({
      type: 'response_item',
      payload: {
        type: 'function_call',
        name: 'request_user_input',
        id: 'call-2'
      }
    }),
    { kind: 'question', eventId: 'question:call-2' }
  );
  assert.deepEqual(
    classifyRecord({
      type: 'event_msg',
      payload: { type: 'request_user_input', call_id: 'call-3' }
    }),
    { kind: 'question', eventId: 'question:call-3' }
  );
});

test('ignores commentary and unrelated tool calls', () => {
  assert.equal(
    classifyRecord({
      type: 'response_item',
      payload: { type: 'message', role: 'assistant', phase: 'commentary' }
    }),
    undefined
  );
  assert.equal(
    classifyRecord({
      type: 'response_item',
      payload: { type: 'custom_tool_call', name: 'apply_patch', id: 'call-4' }
    }),
    undefined
  );
});

test('unread counter tracks, restores, clears, and serializes threads', () => {
  const counter = new UnreadCounter({ old: 2, invalid: 0, negative: -1 });
  counter.increment('new');
  counter.increment('new');
  assert.equal(counter.total, 4);
  assert.equal(counter.getThreadCount('new'), 2);
  assert.equal(counter.clearThread('old'), true);
  assert.equal(counter.clearThread('missing'), false);
  assert.deepEqual(counter.toJSON(), { new: 2 });
  assert.equal(counter.clearAll(), true);
  assert.equal(counter.clearAll(), false);
  assert.equal(counter.total, 0);
});

test('path containment handles exact, nested, sibling, and special-character paths', () => {
  const specialRoot = path.resolve('test-fixtures', "workspace [demo] 'quoted'");
  assert.equal(isPathInside(workspaceRoot, workspaceRoot), true);
  assert.equal(isPathInside(workspaceRoot, nestedWorkspace), true);
  assert.equal(isPathInside(workspaceRoot, otherWorkspace), false);
  assert.equal(isPathInside(specialRoot, path.join(specialRoot, 'child')), true);
});
